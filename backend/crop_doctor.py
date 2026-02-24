"""
NEER — Crop Doctor Agent
Multi-step AI pipeline for crop disease detection.

Pipeline:
  Step 1+2 (merged): Vision AI → validate image + analyze disease (1 API call)
  Step 3 (conditional): KB lookup OR Text AI → treatment plan (0 or 1 API call)

Optimization:
  - If disease matches KB → use verified KB treatments (FREE, no API call)
  - If disease NOT in KB → use Text AI for treatment (1 API call)
  - If healthy or not a plant → return early (total: 1 API call)
"""

import json
import os
from difflib import SequenceMatcher

# ============================================================
# DISEASE KNOWLEDGE BASE
# ============================================================
_KB_PATH = os.path.join(os.path.dirname(__file__), "disease_kb.json")

with open(_KB_PATH, "r", encoding="utf-8") as f:
    DISEASE_KB = json.load(f)

# Pre-build search index: map crop names → relevant diseases
_CROP_DISEASE_MAP = {}
for entry in DISEASE_KB:
    for crop in entry["crops_affected"]:
        crop_lower = crop.lower()
        if crop_lower not in _CROP_DISEASE_MAP:
            _CROP_DISEASE_MAP[crop_lower] = []
        _CROP_DISEASE_MAP[crop_lower].append(entry)

# All disease names for fuzzy matching
_ALL_DISEASE_NAMES = {entry["disease_name"].lower(): entry for entry in DISEASE_KB}
_ALL_DISEASE_IDS = {entry["id"]: entry for entry in DISEASE_KB}


def _fuzzy_match_disease(disease_name: str, threshold: float = 0.55) -> dict | None:
    """
    Fuzzy-match a disease name from the AI against our knowledge base.
    Returns the KB entry if a match is found, else None.
    """
    name_lower = disease_name.lower().strip()

    # 1. Exact match
    if name_lower in _ALL_DISEASE_NAMES:
        return _ALL_DISEASE_NAMES[name_lower]

    # 2. Substring match (e.g., "Early Blight" matches "Early Blight" in "Tomato Early Blight")
    for kb_name, entry in _ALL_DISEASE_NAMES.items():
        if name_lower in kb_name or kb_name in name_lower:
            return entry

    # 3. Check scientific name
    for entry in DISEASE_KB:
        if entry["scientific_name"].lower() in name_lower or name_lower in entry["scientific_name"].lower():
            return entry

    # 4. Fuzzy similarity
    best_match = None
    best_score = 0
    for kb_name, entry in _ALL_DISEASE_NAMES.items():
        score = SequenceMatcher(None, name_lower, kb_name).ratio()
        if score > best_score:
            best_score = score
            best_match = entry

    if best_score >= threshold:
        return best_match

    return None


def get_diseases_for_crop(crop_name: str) -> list[dict]:
    """Get all known diseases for a given crop from the KB."""
    crop_lower = crop_name.lower().strip()
    # Try exact match first
    if crop_lower in _CROP_DISEASE_MAP:
        return _CROP_DISEASE_MAP[crop_lower]
    # Try partial match
    for key, diseases in _CROP_DISEASE_MAP.items():
        if crop_lower in key or key in crop_lower:
            return diseases
    return []


def build_kb_context(crop_name: str) -> str:
    """
    Build a concise KB context string for the AI prompt.
    Lists known diseases for the identified crop so the AI can compare.
    """
    diseases = get_diseases_for_crop(crop_name)
    if not diseases:
        return "No specific disease reference data available for this crop. Use your best judgment."

    lines = [f"REFERENCE — Known diseases for {crop_name}:"]
    for d in diseases:
        symptoms_str = "; ".join(d["symptoms"][:3])  # First 3 symptoms to keep prompt short
        lines.append(f"  • {d['disease_name']} ({d['scientific_name']}): {symptoms_str}")
    lines.append("\nCompare the image against these known patterns. If the disease matches one of above, use that EXACT name.")
    return "\n".join(lines)


# ============================================================
# CROP DOCTOR AGENT
# ============================================================
class CropDoctor:
    """
    Multi-step AI agent for crop disease detection.

    Uses two Gemini function references injected at init:
      - vision_fn(prompt, image_bytes, mime_type) -> str
      - text_fn(prompt) -> str
    """

    def __init__(self, vision_fn, text_fn):
        self.vision = vision_fn
        self.text = text_fn

    def diagnose(self, image_bytes: bytes, mime_type: str, lang: str = "English",
                 state: str = None, season: str = None, crop_hint: str = None) -> dict:
        """
        Run the full diagnostic pipeline.
        If crop_hint is provided, uses targeted KB diseases for higher accuracy.
        If state is provided, filters diseases by region.
        Returns a rich result dict.
        """
        steps_completed = []

        # ── STEP 1+2: Vision AI → Validate + Analyze (MERGED — 1 API call) ──
        print("[CROP DOCTOR] Step 1+2: Running vision analysis...")

        # Build targeted disease reference based on user hints
        crop_hint_line = ""
        if crop_hint:
            # User told us the crop — get SPECIFIC diseases from KB
            targeted = get_diseases_for_crop(crop_hint)
            if state:
                # Further filter by region
                targeted = [
                    d for d in targeted
                    if "All" in str(d.get("common_regions", [])) 
                    or any(state.lower() in r.lower() for r in d.get("common_regions", []))
                ] or targeted  # fallback to all if filter is too narrow
            if targeted:
                diseases_hint = "\n".join(
                    f"  • {d['disease_name']} ({d['scientific_name']}): {'; '.join(d['symptoms'][:2])}"
                    for d in targeted
                )
                print(f"[CROP DOCTOR] User hint: crop='{crop_hint}', state='{state}' → {len(targeted)} targeted diseases")
            else:
                diseases_hint = "\n".join(f"  • {d['disease_name']}" for d in DISEASE_KB[:15])
            crop_hint_line = f"\nIMPORTANT: The user has identified this crop as '{crop_hint}'. Use this to guide your analysis."
        else:
            diseases_hint = "\n".join(f"  • {d['disease_name']}" for d in DISEASE_KB[:15])

        region_hint = ""
        if state:
            region_hint = f"\nREGION CONTEXT: The farmer is located in {state}, India. Consider diseases common to this region."

        vision_prompt = f"""You are 'NEER Crop Doctor', an expert agricultural disease detection AI agent.

TASK: Analyze this plant image in two stages:
1. VALIDATE: Is this a plant/crop image? Identify the crop type and plant part.
2. DIAGNOSE: If it IS a plant, analyze for diseases with maximum specificity.
{crop_hint_line}
{region_hint}

KNOWN DISEASE REFERENCE (compare against these):
{diseases_hint}

RULES:
- Be as specific as possible with disease identification
- For leaf spots, differentiate between Bipolaris, Cercospora, Alternaria, etc.
- If the plant looks healthy, set disease_found to false
- If this is NOT a plant image at all, set is_plant to false
- The response language must be: {lang}
- Translate ALL descriptive text into {lang}

You MUST respond ONLY with a valid JSON object (no markdown, no extra text):
{{
  "is_plant": boolean,
  "crop_type": string or null,
  "plant_part": string or null,
  "disease_found": boolean,
  "disease_candidates": [
    {{
      "name": string,
      "confidence_percentage": integer (0-100)
    }}
  ],
  "severity": "Mild" | "Moderate" | "Severe",
  "symptoms": ["string"],
  "cause": string
}}
Note: "disease_candidates" should be ranked by confidence, and their "confidence_percentage" MUST sum to 100 exactly if disease_found is true. Include at least 2 candidates. If healthy, empty array."""

        raw = self.vision(vision_prompt, image_bytes, mime_type)
        vision_result = self._parse_json(raw)
        steps_completed.append("vision_analysis")

        # ── Early exit: not a plant ──
        if not vision_result.get("is_plant", True):
            print("[CROP DOCTOR] → Not a plant. Returning early.")
            return {
                "status": "success",
                "agent_steps": steps_completed,
                "data": {
                    "is_plant": False,
                    "crop_type": None,
                    "plant_part": None,
                    "disease_found": False,
                    "disease_candidates": [],
                    "severity": "N/A",
                    "symptoms": [],
                    "cause": "",
                    "organic_treatment": [],
                    "chemical_treatment": [],
                    "prevention": [],
                    "kb_match": False,
                    "urgency": "N/A"
                }
            }

        # ── Early exit: healthy plant ──
        if not vision_result.get("disease_found", False):
            print(f"[CROP DOCTOR] → Healthy {vision_result.get('crop_type', 'plant')} detected.")
            return {
                "status": "success",
                "agent_steps": steps_completed,
                "data": {
                    "is_plant": True,
                    "crop_type": vision_result.get("crop_type"),
                    "plant_part": vision_result.get("plant_part"),
                    "disease_found": False,
                    "disease_candidates": [{"name": "Healthy", "confidence_percentage": 100}],
                    "severity": "None",
                    "symptoms": [],
                    "cause": "",
                    "organic_treatment": [],
                    "chemical_treatment": [],
                    "prevention": [],
                    "kb_match": False,
                    "urgency": "No action needed"
                }
            }

        # ── STEP 3: Treatment Plan ──
        candidates = vision_result.get("disease_candidates", [])
        top_candidate = candidates[0] if candidates else {"name": "Unknown", "confidence_percentage": 0}
        disease_name = top_candidate.get("name", "Unknown")
        crop_type = vision_result.get("crop_type", "Unknown crop")
        print(f"[CROP DOCTOR] Top disease detected: {disease_name} on {crop_type} ({top_candidate.get('confidence_percentage', 0)}%)")

        # Try KB match first (FREE — no API call!)
        kb_entry = _fuzzy_match_disease(disease_name)

        if kb_entry:
            # ✅ KB MATCH — use verified data, skip Gemini call
            print(f"[CROP DOCTOR] Step 3: KB MATCH found → '{kb_entry['disease_name']}' (FREE lookup)")
            steps_completed.append("kb_treatment_lookup")

            severity = vision_result.get("severity", kb_entry.get("severity_range", "Moderate"))
            urgency = self._calculate_urgency(severity)
            
            # Ensure the top candidate matches the KB name for consistency
            if candidates:
                 candidates[0]["name"] = kb_entry["disease_name"]

            return {
                "status": "success",
                "agent_steps": steps_completed,
                "data": {
                    "is_plant": True,
                    "crop_type": crop_type,
                    "plant_part": vision_result.get("plant_part"),
                    "disease_found": True,
                    "disease_candidates": candidates,
                    "scientific_name": kb_entry.get("scientific_name", ""),
                    "severity": severity,
                    "symptoms": vision_result.get("symptoms", kb_entry["symptoms"]),
                    "cause": vision_result.get("cause", kb_entry["cause"]),
                    "organic_treatment": kb_entry["organic_treatment"],
                    "chemical_treatment": kb_entry["chemical_treatment"],
                    "prevention": kb_entry["prevention"],
                    "kb_match": True,
                    "urgency": urgency
                }
            }
        else:
            # ❌ No KB match — need Gemini for treatment (1 API call)
            print(f"[CROP DOCTOR] Step 3: No KB match. Querying AI for treatment plan...")
            steps_completed.append("ai_treatment_generation")

            region_ctx = ""
            if state:
                region_ctx += f"\nThe farmer is in {state}."
            if season:
                region_ctx += f" Current season: {season}."

            treatment_prompt = f"""You are 'NEER Crop Doctor', an agricultural treatment specialist.

A disease has been detected:
- Crop: {crop_type}
- Disease: {disease_name}
- Severity: {vision_result.get('severity', 'Unknown')}
- Symptoms observed: {json.dumps(vision_result.get('symptoms', []))}
- Cause: {vision_result.get('cause', 'Unknown')}
{region_ctx}

Generate a treatment plan. Respond ONLY in {lang}.

You MUST respond ONLY with a valid JSON object:
{{
  "organic_treatment": ["step 1", "step 2", "step 3"],
  "chemical_treatment": ["product 1 with dosage", "product 2 with dosage"],
  "prevention": ["tip 1", "tip 2", "tip 3"]
}}"""

            treatment_raw = self.text(treatment_prompt)
            treatment_data = self._parse_json(treatment_raw)

            severity = vision_result.get("severity", "Moderate")
            urgency = self._calculate_urgency(severity)

            return {
                "status": "success",
                "agent_steps": steps_completed,
                "data": {
                    "is_plant": True,
                    "crop_type": crop_type,
                    "plant_part": vision_result.get("plant_part"),
                    "disease_found": True,
                    "disease_candidates": candidates,
                    "severity": severity,
                    "symptoms": vision_result.get("symptoms", []),
                    "cause": vision_result.get("cause", ""),
                    "organic_treatment": treatment_data.get("organic_treatment", []),
                    "chemical_treatment": treatment_data.get("chemical_treatment", []),
                    "prevention": treatment_data.get("prevention", []),
                    "kb_match": False,
                    "urgency": urgency
                }
            }

    def _parse_json(self, raw: str) -> dict:
        """Parse JSON from AI response, robustly finding the first JSON object/array."""
        import re
        text = raw.strip()
        
        # Try to find JSON block using regex if markdown fences are present or if it's mixed with text
        json_match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
        if json_match:
            text = json_match.group(1)
        
        # Cleanup markdown fences if still there
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            # Last ditch effort: find the first { and last }
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end != 0:
                    return json.loads(text[start:end])
            except:
                pass
            print(f"[CROP DOCTOR] JSON parse error: {e}")
            print(f"[CROP DOCTOR] Raw response snippet: {text[:200]}...")
            raise ValueError(f"AI returned invalid JSON: {e}")

    def _calculate_urgency(self, severity: str) -> str:
        """Map severity to urgency level."""
        s = severity.lower() if severity else ""
        if "severe" in s or "urgent" in s:
            return "Act immediately — within 1-2 days"
        elif "moderate" in s:
            return "Act within 3-5 days"
        elif "mild" in s:
            return "Monitor closely, treat within 1 week"
        return "Assess and plan treatment"
