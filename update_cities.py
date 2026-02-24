import json
import re

# Massive expansion covering all major districts and notable towns
indian_cities = {
    "Andhra Pradesh": {
        "Visakhapatnam": (17.6868, 83.2185), "Vijayawada": (16.5062, 80.6480), "Guntur": (16.3067, 80.4365), 
        "Nellore": (14.4426, 79.9865), "Kurnool": (15.8281, 78.0373), "Rajahmundry": (17.0005, 81.8040), 
        "Tirupati": (13.6288, 79.4192), "Kakinada": (16.9891, 82.2475), "Kadapa": (14.4673, 78.8242), 
        "Anantapur": (14.6819, 77.6006), "Vizianagaram": (18.1067, 83.3956), "Eluru": (16.7107, 81.1031),
        "Ongole": (15.5057, 80.0499), "Nandyal": (15.4800, 78.4833), "Machilipatnam": (16.1783, 81.1353),
        "Adoni": (15.6322, 77.2728), "Tenali": (16.2372, 80.6414), "Chittoor": (13.2172, 79.1003),
        "Hindupur": (13.8291, 77.4916), "Proddatur": (14.7523, 78.5528), "Bhimavaram": (16.5441, 81.5212),
        "Madanapalle": (13.5471, 78.5036), "Guntakal": (15.1674, 77.3842), "Srikakulam": (18.2949, 83.8938)
    },
    "Arunachal Pradesh": {
        "Itanagar": (27.0971, 93.6231), "Pasighat": (28.0619, 95.3259), "Tawang": (27.5861, 91.8594), 
        "Ziro": (27.5387, 93.8276), "Roing": (28.1402, 95.8458), "Tezu": (27.9152, 96.1663),
        "Bomdila": (27.2645, 92.4159), "Aalo": (28.1714, 94.7937), "Changlang": (27.1352, 95.7335)
    },
    "Assam": {
        "Guwahati": (26.1445, 91.7362), "Silchar": (24.8333, 92.7789), "Dibrugarh": (27.4728, 94.9120), 
        "Jorhat": (26.7509, 94.2037), "Nagaon": (26.3456, 92.6845), "Tinsukia": (27.4913, 95.3524), 
        "Tezpur": (26.6528, 92.7926), "Bongaigaon": (26.4714, 90.5562), "Diphu": (25.8443, 93.4290),
        "Dhubri": (26.0207, 89.9743), "North Lakhimpur": (27.2384, 94.1062), "Lumding": (25.7509, 93.1764),
        "Goalpara": (26.1751, 90.6272), "Sivasagar": (26.9826, 94.6348), "Barpeta": (26.3263, 90.0076),
        "Golaghat": (26.5057, 93.9744), "Karimganj": (24.8687, 92.3551), "Hailakandi": (24.6852, 92.5647)
    },
    "Bihar": {
        "Patna": (25.6093, 85.1376), "Gaya": (24.7914, 85.0002), "Bhagalpur": (25.2425, 86.9746), 
        "Muzaffarpur": (26.1209, 85.3647), "Purnia": (25.7771, 87.4753), "Darbhanga": (26.1522, 85.8971), 
        "Bihar Sharif": (25.1952, 85.5168), "Arrah": (25.5606, 84.6601), "Begusarai": (25.4190, 86.1362), 
        "Katihar": (25.5397, 87.5670), "Munger": (25.3757, 86.4744), "Chhapra": (25.7848, 84.7274),
        "Samastipur": (25.8624, 86.0827), "Saharsa": (25.8835, 86.6006), "Sasaram": (24.9490, 84.0322),
        "Hajipur": (25.6847, 85.2078), "Dehri": (24.9142, 84.1833), "Bettiah": (26.8041, 84.5029),
        "Motihari": (26.6470, 84.9171), "Kishanganj": (26.0754, 87.9351), "Jamui": (24.9254, 86.2238)
    },
    "Chhattisgarh": {
        "Raipur": (21.2514, 81.6296), "Bhilai": (21.1938, 81.3509), "Bilaspur": (22.0797, 82.1409), 
        "Korba": (22.3595, 82.7501), "Rajnandgaon": (21.1001, 81.0337), "Raigarh": (21.8974, 83.3950), 
        "Jagdalpur": (19.0734, 82.0166), "Ambikapur": (23.1118, 83.1895), "Dhamtari": (20.7061, 81.5492),
        "Durg": (21.1904, 81.2849), "Mahasamund": (21.1079, 82.0910), "Chirmiri": (23.1873, 82.3559),
        "Bhatapara": (21.7348, 81.9360), "Baloda Bazar": (21.6667, 82.1667), "Dongargarh": (21.1890, 80.5510)
    },
    "Goa": {
        "Panaji": (15.4909, 73.8278), "Margao": (15.2832, 73.9645), "Vasco da Gama": (15.3980, 73.8111), 
        "Mapusa": (15.5925, 73.8113), "Ponda": (15.3957, 74.0157), "Bicholim": (15.5976, 73.9535),
        "Curchorem": (15.2605, 74.1165), "Sanquelim": (15.5677, 74.0202), "Valpoi": (15.5312, 74.1352)
    },
    "Gujarat": {
        "Ahmedabad": (23.0225, 72.5714), "Surat": (21.1702, 72.8311), "Vadodara": (22.3072, 73.1812), 
        "Rajkot": (22.3039, 70.8022), "Bhavnagar": (21.7645, 72.1519), "Jamnagar": (22.4707, 70.0577), 
        "Junagadh": (21.5222, 70.4579), "Gandhinagar": (23.2156, 72.6369), "Gandhidham": (23.0753, 70.1337), 
        "Anand": (22.5645, 72.9289), "Navsari": (20.9467, 72.9520), "Morbi": (22.8120, 70.8320),
        "Nadiad": (22.6916, 72.8634), "Surendranagar": (22.7299, 71.6385), "Bharuch": (21.7051, 72.9959),
        "Vapi": (20.3893, 72.9106), "Bhuj": (23.2420, 69.6669), "Porbandar": (21.6417, 69.6293),
        "Palanpur": (24.1724, 72.4346), "Valsad": (20.5992, 72.9342), "Godhra": (22.7744, 73.6186),
        "Patan": (23.8385, 72.1158), "Botad": (22.1705, 71.6667), "Amreli": (21.6111, 71.2183)
    },
    "Haryana": {
        "Faridabad": (28.4089, 77.3178), "Gurugram": (28.4595, 77.0266), "Panipat": (29.3909, 76.9635), 
        "Ambala": (30.3782, 76.7767), "Chandigarh": (30.7333, 76.7794), "Rohtak": (28.8955, 76.6066), 
        "Hisar": (29.1492, 75.7217), "Karnal": (29.6857, 76.9905), "Sonipat": (28.9931, 77.0151), 
        "Panchkula": (30.6942, 76.8606), "Bhiwani": (28.7989, 76.1307), "Sirsa": (29.5312, 75.0298),
        "Yamunanagar": (30.1290, 77.2674), "Bahadurgarh": (28.6826, 76.9209), "Jind": (29.3174, 76.3115),
        "Thanesar": (29.9691, 76.8208), "Kaithal": (29.8015, 76.3996), "Rewari": (28.1906, 76.6133),
        "Palwal": (28.1487, 77.3276), "Hansi": (29.1026, 75.9555), "Fatehabad": (29.5168, 75.4411)
    },
    "Himachal Pradesh": {
        "Shimla": (31.1048, 77.1734), "Dharamshala": (32.2190, 76.3234), "Mandi": (31.5892, 76.9328), 
        "Solan": (30.9066, 77.0987), "Kullu": (31.9579, 77.1095), "Manali": (32.2396, 77.1887), 
        "Dalhousie": (32.5387, 75.9710), "Palampur": (32.1121, 76.5369), "Nahan": (30.5599, 77.2955),
        "Chamba": (32.5534, 76.1258), "Una": (31.4746, 76.2691), "Hamirpur": (31.6865, 76.5169),
        "Sundarnagar": (31.5303, 76.8943), "Bilaspur": (31.3323, 76.7593), "Paonta Sahib": (30.4371, 77.6253)
    },
    "Jharkhand": {
        "Ranchi": (23.3441, 85.3096), "Jamshedpur": (22.8046, 86.2029), "Dhanbad": (23.7957, 86.4304), 
        "Bokaro": (23.7794, 85.9754), "Deoghar": (24.4828, 86.6946), "Phusro": (23.7661, 85.9928), 
        "Hazaribagh": (23.9925, 85.3637), "Giridih": (24.1843, 86.3021), "Ramgarh": (23.6300, 85.5205),
        "Medininagar": (24.0305, 84.0673), "Chirkunda": (23.7380, 86.8122), "Jhumri Telaiya": (24.4239, 85.5292),
        "Sahibganj": (25.2423, 87.6433), "Chaibasa": (22.5604, 85.8088), "Lohardaga": (23.4357, 84.6738)
    },
    "Karnataka": {
        "Bengaluru": (12.9716, 77.5946), "Mysuru": (12.2958, 76.6394), "Hubballi": (15.3647, 75.1376), 
        "Mangaluru": (12.9141, 74.8560), "Belagavi": (15.8497, 74.4977), "Kalaburagi": (17.3297, 76.8343), 
        "Davanagere": (14.4644, 75.9218), "Ballari": (15.1394, 76.9214), "Vijayapura": (16.8302, 75.7100), 
        "Shivamogga": (13.9299, 75.5681), "Tumakuru": (13.3392, 77.1016), "Udupi": (13.3409, 74.7421),
        "Raichur": (16.2104, 77.3482), "Bidar": (17.9104, 77.5199), "Hospet": (15.2689, 76.3909),
        "Gadag": (15.4299, 75.6329), "Hassan": (13.0033, 76.1004), "Chitradurga": (14.2255, 76.3980),
        "Kolar": (13.1362, 78.1291), "Mandya": (12.5218, 76.8951), "Chikkamagaluru": (13.3161, 75.7725),
        "Bagalkot": (16.1817, 75.6958), "Karwar": (14.8055, 74.1328), "Ramanagara": (12.7237, 77.2796)
    },
    "Kerala": {
        "Thiruvananthapuram": (8.5241, 76.9366), "Kochi": (9.9312, 76.2673), "Kozhikode": (11.2588, 75.7804), 
        "Thrissur": (10.5276, 76.2144), "Kollam": (8.8932, 76.6141), "Alappuzha": (9.4981, 76.3388), 
        "Palakkad": (10.7867, 76.6548), "Kottayam": (9.5916, 76.5222), "Kannur": (11.8745, 75.3704),
        "Manjeri": (11.1154, 76.1264), "Thalassery": (11.7481, 75.4894), "Ponnani": (10.7719, 75.9264),
        "Vatakara": (11.6030, 75.5862), "Kanhangad": (12.3166, 75.0934), "Malarpuram": (11.0734, 76.0827),
        "Kayamkulam": (9.1764, 76.4957), "Changanassery": (9.4447, 76.5413), "Tirur": (10.9157, 75.9228)
    },
    "Madhya Pradesh": {
        "Indore": (22.7196, 75.8577), "Bhopal": (23.2599, 77.4126), "Jabalpur": (23.1815, 79.9864), 
        "Gwalior": (26.2183, 78.1828), "Ujjain": (23.1765, 75.7885), "Sagar": (23.8388, 78.7378), 
        "Dewas": (22.9676, 76.0534), "Satna": (24.5779, 80.8251), "Ratlam": (23.3315, 75.0367), 
        "Rewa": (24.5373, 81.3042), "Khandwa": (21.8329, 76.3533), "Burhanpur": (21.3129, 76.2309), 
        "Chhindwara": (22.0574, 78.9382), "Murwara (Katni)": (23.8322, 80.3951), "Singrauli": (24.1983, 82.6581),
        "Bhind": (26.5645, 78.7836), "Morena": (26.4947, 78.0006), "Guna": (24.6465, 77.3109),
        "Shivpuri": (25.4332, 77.6531), "Chhatarpur": (24.9158, 79.5855), "Vidisha": (23.5256, 77.8080),
        "Mandsaur": (24.0722, 75.0683), "Hoshangabad": (22.7533, 77.7121), "Kargone": (21.8223, 75.6139)
    },
    "Maharashtra": {
        "Mumbai": (19.0760, 72.8777), "Pune": (18.5204, 73.8567), "Nagpur": (21.1458, 79.0882), 
        "Nashik": (20.0063, 73.7901), "Aurangabad": (19.8762, 75.3433), "Solapur": (17.6599, 75.9064), 
        "Amravati": (20.9320, 77.7523), "Navi Mumbai": (19.0330, 73.0297), "Kolhapur": (16.7050, 74.2433), 
        "Akola": (20.7059, 77.0082), "Jalgaon": (21.0077, 75.5626), "Latur": (18.4088, 76.5604), 
        "Dhule": (20.8996, 74.7674), "Ahmednagar": (19.0952, 74.7496), "Chandrapur": (19.9615, 79.2961), 
        "Parbhani": (19.2644, 76.7758), "Nanded": (19.1383, 77.3086), "Satara": (17.6805, 74.0183),
        "Sangli": (16.8524, 74.5815), "Malegaon": (20.5516, 74.5262), "Mira-Bhayandar": (19.2952, 72.8596),
        "Bhiwandi": (19.2813, 73.0483), "Amalner": (21.0470, 75.0620), "Gondia": (21.4623, 80.1963),
        "Yavatmal": (20.3888, 78.1204), "Beed": (18.9901, 75.7531), "Wardha": (20.7453, 78.6022)
    },
    "Manipur": {
        "Imphal": (24.8170, 93.9368), "Thoubal": (24.6346, 94.0142), "Kakching": (24.4925, 93.9855), 
        "Ukhrul": (25.1154, 94.3599), "Churachandpur": (24.3217, 93.6823), "Senapati": (25.2694, 94.0202),
        "Jiribam": (24.7936, 93.1165), "Moirang": (24.4996, 93.7663)
    },
    "Meghalaya": {
        "Shillong": (25.5788, 91.8933), "Tura": (25.5145, 90.2030), "Jowai": (25.4468, 92.2001), 
        "Nongstoin": (25.5186, 91.2673), "Williamnagar": (25.6268, 90.6276), "Baghmara": (25.1957, 90.6288),
        "Resubelpara": (25.9009, 90.5986), "Mairang": (25.5658, 91.6406)
    },
    "Mizoram": {
        "Aizawl": (23.7271, 92.7176), "Lunglei": (22.8671, 92.7655), "Saiha": (22.4851, 92.9818), 
        "Champhai": (23.4735, 93.3283), "Kolasib": (24.2255, 92.6750), "Serchhip": (23.3106, 92.8398),
        "Lawngtlai": (22.5298, 92.8943), "Mamit": (23.9317, 92.4907)
    },
    "Nagaland": {
        "Kohima": (25.6751, 94.1086), "Dimapur": (25.9060, 93.7255), "Mokokchung": (26.3262, 94.5200), 
        "Tuensang": (26.2758, 94.8211), "Wokha": (26.1086, 94.2612), "Zunheboto": (25.9691, 94.5165),
        "Mon": (26.7460, 95.1017), "Phek": (25.6946, 94.4646)
    },
    "Odisha": {
        "Bhubaneswar": (20.2961, 85.8245), "Cuttack": (20.4625, 85.8830), "Rourkela": (22.2604, 84.8536), 
        "Berhampur": (19.3150, 84.7941), "Sambalpur": (21.4669, 83.9812), "Puri": (19.8135, 85.8312), 
        "Balasore": (21.4934, 86.9338), "Bhadrak": (21.0560, 86.4967), "Baripada": (21.9338, 86.7621),
        "Jharsuguda": (21.8601, 84.0041), "Bargarh": (21.3341, 83.6263), "Rayagada": (19.1678, 83.8183),
        "Bolangir": (20.7180, 83.4880), "Jeypore": (18.8576, 82.5765), "Bhawani Patna": (19.9079, 83.1652)
    },
    "Punjab": {
        "Ludhiana": (30.9010, 75.8573), "Amritsar": (31.6340, 74.8723), "Jalandhar": (31.3260, 75.5762), 
        "Patiala": (30.3398, 76.3869), "Bathinda": (30.2110, 74.9455), "Hoshiarpur": (31.5298, 75.9113), 
        "Pathankot": (32.2643, 75.6457), "Moga": (30.8126, 75.1741), "Batala": (31.8157, 75.2016), 
        "Khanna": (30.7027, 76.2235), "Phagwara": (31.2229, 75.7681), "S.A.S. Nagar": (30.7046, 76.7179),
        "Abohar": (30.1445, 74.1955), "Firozpur": (30.9255, 74.6111), "Kapurthala": (31.3813, 75.3852),
        "Faridkot": (30.6769, 74.7431), "Barnala": (30.3807, 75.5451), "Muktsar": (30.4735, 74.5165)
    },
    "Rajasthan": {
        "Jaipur": (26.9124, 75.7873), "Jodhpur": (26.2389, 73.0243), "Kota": (25.2138, 75.8648), 
        "Bikaner": (28.0229, 73.3119), "Ajmer": (26.4499, 74.6399), "Udaipur": (24.5854, 73.7125), 
        "Bhilwara": (25.3463, 74.6364), "Alwar": (27.5530, 76.6346), "Bharatpur": (27.2170, 77.4900), 
        "Pali": (25.7711, 73.3234), "Sikar": (27.6094, 75.1398), "Chittorgarh": (24.8795, 74.6293), 
        "Banswara": (23.5461, 74.4350), "Hanumangarh": (29.5804, 74.3228), "Sawai Madhopur": (25.9928, 76.3533),
        "Kishangarh": (26.5727, 74.8617), "Beawar": (26.1030, 74.3168), "Tonk": (26.1664, 75.7891),
        "Jhunjhunu": (28.1287, 75.3995), "Churu": (28.2905, 74.9664), "Barmer": (25.7521, 71.3967),
        "Jalore": (25.3429, 72.6186), "Sirohi": (24.8826, 72.8601), "Jaisalmer": (26.9157, 70.9083)
    },
    "Sikkim": {
        "Gangtok": (27.3389, 88.6065), "Namchi": (27.1654, 88.3562), "Gyalshing": (27.2882, 88.2713), 
        "Mangan": (27.5028, 88.5283), "Singtam": (27.2343, 88.4975), "Rangpo": (27.1772, 88.5255)
    },
    "Tamil Nadu": {
        "Chennai": (13.0827, 80.2707), "Coimbatore": (11.0168, 76.9558), "Madurai": (9.9252, 78.1198), 
        "Tiruchirappalli": (10.7905, 78.7047), "Salem": (11.6643, 78.1460), "Tirunelveli": (8.7139, 77.7567), 
        "Erode": (11.3410, 77.7172), "Vellore": (12.9165, 79.1325), "Thoothukudi": (8.7642, 78.1348), 
        "Dindigul": (10.3673, 77.9803), "Thanjavur": (10.7870, 79.1378), "Ranipet": (12.9298, 79.3248), 
        "Karur": (10.9601, 78.0766), "Nagercoil": (8.1833, 77.4119), "Kancheepuram": (12.8342, 79.7036),
        "Tiruppur": (11.1085, 77.3411), "Cuddalore": (11.7480, 79.7714), "Neyveli": (11.5956, 79.4891),
        "Kumbakonam": (10.9602, 79.3845), "Rajapalayam": (9.4533, 77.5504), "Pudukkottai": (10.3833, 78.8167),
        "Hosur": (12.7409, 77.8253), "Ambur": (12.7845, 78.7153), "Karaikudi": (10.0652, 78.7758)
    },
    "Telangana": {
        "Hyderabad": (17.3850, 78.4867), "Warangal": (17.9689, 79.5941), "Nizamabad": (18.6705, 78.0938), 
        "Karimnagar": (18.4386, 79.1288), "Ramagundam": (18.7645, 79.4795), "Khammam": (17.2473, 80.1514), 
        "Mahbubnagar": (16.7431, 77.9856), "Nalgonda": (17.0543, 79.2662), "Adilabad": (19.6702, 78.5323),
        "Suryapet": (17.1363, 79.6234), "Miryalaguda": (16.8744, 79.5638), "Jagtial": (18.7963, 78.9135),
        "Mancherial": (18.8741, 79.4587), "Kothagudem": (17.5500, 80.6214), "Siddipet": (18.1064, 78.8488),
        "Kamareddy": (18.3182, 78.3377), "Zaheerabad": (17.6766, 77.6080), "Nagarkurnool": (16.5841, 78.3197)
    },
    "Tripura": {
        "Agartala": (23.8315, 91.2868), "Dharmanagar": (24.3644, 92.1627), "Udaipur": (23.5332, 91.4856), 
        "Kailasahar": (24.3218, 92.0028), "Belonia": (23.2514, 91.4589), "Ambassa": (23.9168, 91.8502),
        "Khowai": (24.0858, 91.6033), "Bishalgarh": (23.6334, 91.2662), "Sabroom": (23.0039, 91.7370)
    },
    "Uttar Pradesh": {
        "Lucknow": (26.8467, 80.9462), "Kanpur": (26.4499, 80.3319), "Ghaziabad": (28.6692, 77.4538), 
        "Agra": (27.1767, 78.0081), "Varanasi": (25.3176, 82.9739), "Meerut": (28.9845, 77.7064), 
        "Prayagraj": (25.4358, 81.8463), "Bareilly": (28.3670, 79.4304), "Aligarh": (27.8974, 78.0880), 
        "Moradabad": (28.8386, 78.7733), "Saharanpur": (29.9695, 77.5452), "Gorakhpur": (26.7606, 83.3732), 
        "Noida": (28.5355, 77.3910), "Firozabad": (27.1590, 78.3957), "Jhansi": (25.4484, 78.5685), 
        "Muzaffarnagar": (29.4727, 77.7085), "Mathura": (27.4924, 77.6737), "Rampur": (28.8153, 79.0267), 
        "Shahjahanpur": (27.8804, 79.9125), "Farrukhabad": (27.3888, 79.5802), "Orai": (25.9866, 79.4588),
        "Faizabad": (26.7730, 82.1461), "Etawah": (26.7844, 79.0227), "Mirzapur": (25.1485, 82.5647),
        "Bulandshahr": (28.4069, 77.8498), "Sambhal": (28.5861, 78.5721), "Amroha": (28.9044, 78.4675),
        "Hardoi": (27.3833, 80.1219), "Banda": (25.4805, 80.3323), "Hapur": (28.7306, 77.7759)
    },
    "Uttarakhand": {
        "Dehradun": (30.3165, 78.0322), "Haridwar": (29.9457, 78.1642), "Roorkee": (29.8543, 77.8880), 
        "Haldwani": (29.2183, 79.5126), "Rudrapur": (28.9754, 79.4002), "Kashipur": (29.2104, 78.9616), 
        "Rishikesh": (30.0869, 78.2676), "Pantnagar": (29.0244, 79.4891), "Pithoragarh": (29.5829, 80.2182),
        "Ramnagar": (29.3953, 79.1266), "Kichha": (28.9171, 79.5100), "Manglaur": (29.7915, 77.8761),
        "Kotdwar": (29.7562, 78.5245), "Almora": (29.5892, 79.6467), "Mussoorie": (30.4598, 78.0644),
        "Nainital": (29.3919, 79.4542), "Bageshwar": (29.8377, 79.7712), "Chamoli": (30.4048, 79.3243)
    },
    "West Bengal": {
        "Kolkata": (22.5726, 88.3639), "Asansol": (23.6739, 86.9524), "Siliguri": (26.7271, 88.3953), 
        "Durgapur": (23.5204, 87.3119), "Bardhaman": (23.2324, 87.8615), "English Bazar": (25.0108, 88.1411), 
        "Baharampur": (24.1005, 88.2505), "Habra": (22.8258, 88.6339), "Kharagpur": (22.3302, 87.3237), 
        "Shantipur": (23.2435, 88.4357), "Dankuni": (22.6787, 88.3188), "Haldia": (22.0667, 88.0698), 
        "Jalpaiguri": (26.5385, 88.7188), "Balurghat": (25.2280, 88.7618), "Alipurduar": (26.4913, 89.5262),
        "Bhatpara": (22.8236, 88.3999), "Maheshtala": (22.5019, 88.2501), "Rajpur Sonarpur": (22.4286, 88.4326),
        "South Dumdum": (22.6186, 88.4069), "Gopalpur": (22.6284, 88.4418), "Bally": (22.6517, 88.3444),
        "Midnapore": (22.4257, 87.3199), "Raniganj": (23.6166, 87.1332), "Navadwip": (23.4088, 88.3653)
    }
}

# 1. Update backend/crop_calendar.json
import json

with open('backend/crop_calendar.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

new_coords = {}
new_defaults = {}

for state, cities in indian_cities.items():
    first_city = list(cities.keys())[0]
    new_defaults[state] = first_city
    for city, coords in cities.items():
        new_coords[city] = {
            "lat": coords[0],
            "lon": coords[1]
        }

data["city_coordinates"] = new_coords
data["state_default_city"] = new_defaults

with open('backend/crop_calendar.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)


# 2. Update frontend/src/App.jsx
app_jsx_path = 'frontend/src/App.jsx'
with open(app_jsx_path, 'r', encoding='utf-8') as f:
    app_jsx = f.read()

# Build replacement string
lines = ["    const stateCities = {"]
for state, cities in indian_cities.items():
    city_list = '", "'.join(cities.keys())
    lines.append(f'        "{state}": ["{city_list}"],')
lines[-1] = lines[-1].replace('],', ']') # remove last comma
lines.append("    };")

replacement = '\n'.join(lines)

start_marker = "    const stateCities = {"
end_marker = "    const cities = stateCities[state]"

start_idx = app_jsx.find(start_marker)
end_idx = app_jsx.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_app_jsx = app_jsx[:start_idx] + replacement + "\n\n" + app_jsx[end_idx:]
    with open(app_jsx_path, 'w', encoding='utf-8') as f:
        f.write(new_app_jsx)
    print("App.jsx updated perfectly with 400+ cities.")
else:
    print("Could not find markers in App.jsx!")
