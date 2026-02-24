"""
NEER — Scheme Navigator Agent
Hybrid pipeline for smart government scheme matching.

Pipeline:
  Step 1: ELIGIBILITY FILTER — pure logic, no API call
    → Filter by state + land size from expanded DB
  Step 2: SMART RANKING — AI call
    → Rank by relevance, assign color tiers
    → If crop health context exists, prioritize disease/insurance schemes

Tier System:
  🔴 critical  — Immediate relief (crop insurance when disease severe)
  🟡 recommended — High-benefit match for farmer's situation
  🟢 available  — Eligible but not urgent
"""

import json
import os

# ============================================================
# SCHEMES DATABASE
# ============================================================
_SCHEMES_PATH = os.path.join(os.path.dirname(__file__), "schemes.json")

with open(_SCHEMES_PATH, "r", encoding="utf-8") as f:
    SCHEMES_DB = json.load(f)


def _parse_land_limit(text):
    """Try to extract numeric acre limit from text, or return None."""
    if text is None:
        return None
    return float(text)


class SchemeNavigator:
    """
    Multi-step agent for government scheme matching.

    Uses text_fn injected at init:
      - text_fn(prompt) -> str
    """

    def __init__(self, text_fn):
        self.text = text_fn

    def find_schemes(self, state: str, land_size: float, lang: str = "English",
                     crop_context: dict = None) -> dict:
        """
        Run the full scheme matching pipeline.
        
        Args:
            state: Indian state name
            land_size: Land owned in acres
            lang: Response language
            crop_context: Optional dict from Crop Doctor: {disease_name, severity, crop_type}
        """
        steps_completed = []

        # ── STEP 1: ELIGIBILITY FILTER (FREE — no API call) ──
        print(f"[SCHEME NAV] Step 1: Filtering schemes for {state}, {land_size} acres...")
        eligible = self._filter_eligible(state, land_size)
        steps_completed.append("eligibility_filter")
        
        print(f"[SCHEME NAV] → {len(eligible)} schemes eligible out of {len(SCHEMES_DB)} total")

        if not eligible:
            return {
                "status": "success",
                "agent_steps": steps_completed,
                "total_schemes": 0,
                "schemes": [],
                "summary": "No matching schemes found for your state and land size."
            }

        # ── STEP 2: SMART RANKING + TIER ASSIGNMENT (1 API call) ──
        print("[SCHEME NAV] Step 2: AI ranking + tier assignment...")
        steps_completed.append("ai_ranking")

        # Pre-assign tiers based on rules before AI (helps the AI)
        pre_tiered = self._pre_assign_tiers(eligible, crop_context)

        # Build concise scheme summaries for the AI prompt
        scheme_summaries = []
        for s in pre_tiered:
            hint = f"[PRE-TIER: {s['_pre_tier']}] " if s.get('_pre_tier') else ""
            scheme_summaries.append(
                f"  {s['id']}: {hint}{s['name']} — {s['short']} | Category: {s['category']} | Tags: {', '.join(s.get('tags', []))}"
            )
        schemes_block = "\n".join(scheme_summaries)

        # Crop context for the AI
        crop_info = ""
        if crop_context:
            crop_info = f"""
CROP HEALTH CONTEXT (from Crop Doctor analysis):
- Crop: {crop_context.get('crop_type', 'Unknown')}
- Disease: {crop_context.get('disease_name', 'None')}
- Severity: {crop_context.get('severity', 'Unknown')}
Use this to PRIORITIZE insurance/disaster relief schemes if disease is severe."""

        ranking_prompt = f"""You are 'NEER Scheme Navigator', an expert government scheme advisor for Indian farmers.

FARMER PROFILE:
- State: {state}
- Land: {land_size} acres
{crop_info}

ELIGIBLE SCHEMES (already filtered by state + land):
{schemes_block}

TASK: Rank these schemes from most beneficial to least for this farmer. Assign each a tier:
- "critical": Schemes the farmer MUST apply for immediately (crop insurance if disease severe, income support if small farmer)
- "recommended": Highly beneficial schemes matching the farmer's specific situation
- "available": Eligible but lower priority/general schemes

RULES:
- If crop disease is severe → PMFBY and insurance schemes = "critical"
- Income support schemes matching the state → "recommended"  
- Small farmers (< 3 acres) → prioritize income support + credit schemes
- Respond ONLY in {lang}
- You MUST keep the scheme names in their ORIGINAL form (do not translate scheme names)
- Translate ONLY the 'reason' field into {lang}

You MUST respond ONLY with valid JSON (no markdown):
{{
  "ranked_schemes": [
    {{
      "id": "scheme_id",
      "tier": "critical" | "recommended" | "available",
      "reason": "One-line why this is important for this farmer (in {lang})"
    }}
  ],
  "summary": "2-3 line personalized overview for the farmer (in {lang})"
}}"""

        try:
            raw = self.text(ranking_prompt)
            ranking = self._parse_json(raw)
        except Exception as e:
            print(f"[SCHEME NAV] AI ranking failed: {e}, using pre-tier fallback")
            # Fallback: use pre-assigned tiers
            ranking = self._fallback_ranking(pre_tiered, lang)

        # Merge AI ranking with full scheme data
        result_schemes = self._merge_results(eligible, ranking)

        return {
            "status": "success",
            "agent_steps": steps_completed,
            "total_schemes": len(result_schemes),
            "summary": ranking.get("summary", f"Found {len(result_schemes)} schemes matching your profile."),
            "schemes": result_schemes
        }

    def _filter_eligible(self, state: str, land_size: float) -> list:
        """Filter schemes by state and land size."""
        eligible = []
        for scheme in SCHEMES_DB:
            # State check
            states = scheme.get("states", [])
            state_match = "All" in states or state in states
            if not state_match:
                continue

            # Land size check
            max_land = scheme.get("max_land_acres")
            if max_land is not None and land_size > max_land:
                continue

            min_land = scheme.get("min_land_acres")
            if min_land is not None and land_size < min_land:
                continue

            eligible.append(scheme.copy())

        return eligible

    def _pre_assign_tiers(self, schemes: list, crop_context: dict = None) -> list:
        """Pre-assign tier hints based on rule logic (helps the AI)."""
        severity = ""
        if crop_context:
            severity = (crop_context.get("severity") or "").lower()

        for s in schemes:
            urgency_triggers = s.get("urgency_when", [])

            if crop_context and severity:
                # Check if disease context triggers urgency
                if "disease_severe" in urgency_triggers and "severe" in severity:
                    s["_pre_tier"] = "critical"
                elif "crop_loss" in urgency_triggers and severity in ["severe", "moderate"]:
                    s["_pre_tier"] = "critical"
                elif any(t in urgency_triggers for t in ["disease_severe", "crop_loss", "natural_disaster"]):
                    s["_pre_tier"] = "recommended"
                else:
                    s["_pre_tier"] = "available"
            else:
                # No crop context — use category-based hints
                if s["category"] in ["income_support", "credit"]:
                    s["_pre_tier"] = "recommended"
                else:
                    s["_pre_tier"] = "available"

        return schemes

    def _merge_results(self, eligible: list, ranking: dict) -> list:
        """Merge AI ranking with full scheme data."""
        # Build lookup
        scheme_map = {s["id"]: s for s in eligible}
        ranked = ranking.get("ranked_schemes", [])

        results = []
        used_ids = set()

        # First add ranked schemes in order
        for r in ranked:
            sid = r.get("id", "")
            if sid in scheme_map:
                s = scheme_map[sid]
                results.append({
                    "id": s["id"],
                    "name": s["name"],
                    "short": s["short"],
                    "category": s["category"],
                    "tier": r.get("tier", "available"),
                    "reason": r.get("reason", ""),
                    "benefits": s["benefits"],
                    "apply_url": s.get("apply_url", ""),
                    "apply_steps": s.get("apply_steps", []),
                    "tags": s.get("tags", [])
                })
                used_ids.add(sid)

        # Add any eligible schemes not ranked by AI (as "available")
        for s in eligible:
            if s["id"] not in used_ids:
                results.append({
                    "id": s["id"],
                    "name": s["name"],
                    "short": s["short"],
                    "category": s["category"],
                    "tier": s.get("_pre_tier", "available"),
                    "reason": "",
                    "benefits": s["benefits"],
                    "apply_url": s.get("apply_url", ""),
                    "apply_steps": s.get("apply_steps", []),
                    "tags": s.get("tags", [])
                })

        # Sort: critical first, then recommended, then available
        tier_order = {"critical": 0, "recommended": 1, "available": 2}
        results.sort(key=lambda x: tier_order.get(x["tier"], 2))

        return results

    def _fallback_ranking(self, schemes: list, lang: str) -> dict:
        """Fallback ranking when AI fails — uses pre-assigned tiers."""
        ranked = []
        for s in schemes:
            ranked.append({
                "id": s["id"],
                "tier": s.get("_pre_tier", "available"),
                "reason": s["short"]
            })
        return {
            "ranked_schemes": ranked,
            "summary": f"Found {len(ranked)} eligible schemes based on your profile."
        }

    def _parse_json(self, raw: str) -> dict:
        """Parse JSON from AI response."""
        text = raw.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            print(f"[SCHEME NAV] JSON parse error: {e}")
            raise ValueError(f"AI returned invalid JSON: {e}")
