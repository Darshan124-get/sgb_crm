// ============================================================
// location-data.js — Comprehensive Indian Locations & Combobox Helper
// Provides full hierarchical State -> District -> Taluk data for India
// ============================================================

(function () {
    const KARNATAKA_DISTRICTS = {
        "Bagalkot": ["Bagalkot", "Badami", "Bilgi", "Guledgudda", "Hunagund", "Ilkal", "Jamkhandi", "Mudhol", "Rabkavi Banhatti"],
        "Ballari (Bellary)": ["Ballari", "Kampli", "Kurugodu", "Sandur", "Siruguppa"],
        "Belagavi (Belgaum)": ["Athani", "Bailhongal", "Belagavi", "Chikkodi", "Gokak", "Hukkeri", "Kagawad", "Khanapur", "Kittur", "Mudalgi", "Nippani", "Ramdurg", "Raybag", "Saundatti"],
        "Bengaluru Rural": ["Devanahalli", "Doddaballapura", "Hoskote", "Nelamangala"],
        "Bengaluru Urban": ["Anekal", "Bengaluru North", "Bengaluru South", "Bengaluru East", "Yelahanka"],
        "Bidar": ["Aurad", "Basavakalyan", "Bhalki", "Bidar", "Homnabad", "Hulsoor", "Kamalnagar"],
        "Chamarajanagar": ["Chamarajanagar", "Gundlupet", "Hanur", "Kollegal", "Yelandur"],
        "Chikkaballapura": ["Bagepalli", "Chelur", "Chikkaballapura", "Chintamani", "Gauribidanur", "Gudibanda", "Sidlaghatta"],
        "Chikkamagaluru (Chikmagalur)": ["Ajjampura", "Chikkamagaluru", "Kadur", "Kalasa", "Koppa", "Mudigere", "Narasimharajapura", "Sringeri", "Tarikere"],
        "Chitradurga": ["Challakere", "Chitradurga", "Hiriyur", "Holalkere", "Hosadurga", "Molakalmuru"],
        "Dakshina Kannada (Mangalore)": ["Bantwal", "Belthangady", "Kadaba", "Mangaluru", "Moodabidri", "Puttur", "Sullia"],
        "Davanagere": ["Channagiri", "Davanagere", "Harihara", "Honnali", "Nyamathi"],
        "Dharwad": ["Alnavar", "Annigeri", "Dharwad", "Hubballi Rural", "Hubballi Urban", "Kundgol", "Navalgund"],
        "Gadag": ["Gadag", "Gajendragad", "Lakshmeshwar", "Mundargi", "Nargund", "Ron", "Shirahatti"],
        "Hassan": ["Alur", "Arkalgud", "Arsikere", "Belur", "Channarayapatna", "Hassan", "Holenarasipura", "Sakleshpur"],
        "Haveri": ["Byadgi", "Hangal", "Haveri", "Hirekerur", "Ranebennur", "Rattihalli", "Savanur", "Shiggaon"],
        "Kalaburagi (Gulbarga)": ["Afzalpur", "Aland", "Chincholi", "Chitapur", "Jevargi", "Kalaburagi", "Kalgi", "Kamalapur", "Sedam", "Shahabad", "Yadrav"],
        "Kodagu (Coorg)": ["Kushalnagar", "Madikeri", "Ponnampet", "Somwarpet", "Virajpet"],
        "Kolar": ["Bangarapet", "KGF", "Kolar", "Malur", "Mulbagal", "Srinivaspur"],
        "Koppal": ["Gangavathi", "Kanakagiri", "Karatagi", "Koppal", "Kukanoor", "Kushtagi", "Yelburga"],
        "Mandya": ["Krishnarajpet", "Maddur", "Malavalli", "Mandya", "Nagamangala", "Pandavapura", "Srirangapatna"],
        "Mysuru (Mysore)": ["Heggadadevankote", "Hunsur", "Krishnarajanagara", "Mysuru", "Nanjangud", "Piriyapatna", "Saligrama", "Saragur", "T. Narasipura"],
        "Raichur": ["Deodurg", "Lingsugur", "Manvi", "Maski", "Raichur", "Sindhanur", "Sirwar"],
        "Ramanagara": ["Channapatna", "Harohalli", "Kanakapura", "Magadi", "Ramanagara"],
        "Shivamogga (Shimoga)": ["Bhadravathi", "Hosanagara", "Sagara", "Shikaripura", "Shivamogga", "Soraba", "Thirthahalli"],
        "Tumakuru (Tumkur)": ["Chiknayakanhalli", "Gubbi", "Koratagere", "Kunigal", "Madhugiri", "Pavagada", "Sira", "Tiptur", "Tumakuru", "Turuvekere"],
        "Udupi": ["Brahmavara", "Byndoor", "Hebri", "Karkala", "Kaup", "Kundapura", "Udupi"],
        "Uttara Kannada (Karwar)": ["Ankola", "Bhatkal", "Dandeli", "Haliyal", "Honnavar", "Joida", "Karwar", "Kumta", "Mundgod", "Siddapur", "Sirsi", "Yellapur"],
        "Vijayanagara": ["Hagaribommanahalli", "Harapanahalli", "Hoovina Hadagali", "Hosapete", "Kotturu", "Kudligi"],
        "Vijayapura (Bijapur)": ["Babaleshwar", "Basavana Bagewadi", "Chadchan", "Devara Hippargi", "Indi", "Kolhar", "Muddebihal", "Nidagundi", "Sindagi", "Talikoti", "Tikota", "Vijayapura"],
        "Yadgir": ["Gurmitkal", "Hunasagi", "Shahapur", "Shorapur", "Vadagera", "Yadgir"]
    };

    const TAMIL_NADU_DISTRICTS = {
        "Chennai": ["Egmore", "Guindy", "Mylapore", "Tondiarpet", "Velachery", "Aminjikarai", "Ayanavaram", "Perambur", "Purasawalkam"],
        "Coimbatore": ["Coimbatore North", "Coimbatore South", "Pollachi", "Mettupalayam", "Sulur", "Valparai", "Annur", "Kinathukadavu", "Madukkarai"],
        "Dharmapuri": ["Dharmapuri", "Harur", "Palakkodu", "Pennagaram", "Karimangalam", "Nallampalli", "Pappireddipatti"],
        "Dindigul": ["Dindigul East", "Dindigul West", "Palani", "Kodaikanal", "Natham", "Nilakottai", "Oddanchatram", "Vedasandur", "Athoor", "Gujiliamparai"],
        "Erode": ["Erode", "Bhavani", "Gobichettipalayam", "Perundurai", "Sathyamangalam", "Anthiyur", "Kodumudi", "Modakkurichi", "Thalavadi"],
        "Krishnagiri": ["Krishnagiri", "Hosur", "Pochampalli", "Uthangarai", "Denkanikottai", "Bargur", "Shoolagiri", "Anchetty"],
        "Madurai": ["Madurai North", "Madurai South", "Melur", "Thirumangalam", "Usilampatti", "Vadipatti", "Peraiyur", "Madurai East", "Madurai West", "Thirupparankundram"],
        "Salem": ["Salem", "Attur", "Mettur", "Omalur", "Edappadi", "Gangavalli", "Sankari", "Valapady", "Yercaud", "Kadayampatti", "Peddanaickenpalayam", "Salem South", "Salem West"],
        "Tiruchirappalli": ["Tiruchirappalli East", "Tiruchirappalli West", "Manapparai", "Musiri", "Lalgudi", "Thuraiyur", "Srirangam", "Marungapuri", "Thottiyam"],
        "Tirunelveli": ["Tirunelveli", "Ambasamudram", "Nanguneri", "Palayamkottai", "Radhapuram", "Cheranmahadevi", "Manur", "Tisayanvilai"],
        "Tiruppur": ["Tiruppur North", "Tiruppur South", "Avinashi", "Dharapuram", "Kangeyam", "Udumalaipettai", "Madathukulam", "Uthukuli"],
        "Vellore": ["Vellore", "Katpadi", "Gudiyatham", "Anaicut", "K.V. Kuppam", "Pernambut"],
        "Ariyalur": ["Ariyalur", "Sendurai", "Udayarpalayam", "Andimadam"],
        "Chengalpattu": ["Chengalpattu", "Cheyyur", "Maduranthakam", "Pallavaram", "Tambaram", "Thiruporur", "Vandalur"],
        "Cuddalore": ["Cuddalore", "Chidambaram", "Kattumannarkoil", "Kurinjipadi", "Panruti", "Srimushnam", "Titakudi", "Veppur", "Vriddhachalam"],
        "Kallakurichi": ["Kallakurichi", "Chinnasalem", "Kalvarayan Hills", "Sankarapuram", "Tirukoilur", "Ulundurpet"],
        "Kanchipuram": ["Kanchipuram", "Kundrathur", "Sriperumbudur", "Uthiramerur", "Walajabad"],
        "Kanyakumari": ["Agastheeswaram", "Kalkulam", "Killiyoor", "Thiruvattar", "Thovalai", "Vilavancode"],
        "Karur": ["Karur", "Aravakurichi", "Kadavur", "Krishnarayapuram", "Kulithalai", "Manmangalam", "Pugalur"],
        "Mayiladuthurai": ["Mayiladuthurai", "Kuthalam", "Sirkazhi", "Tharangambadi"],
        "Nagapattinam": ["Nagapattinam", "Kilvelur", "Thirukkuvalai", "Vedaranyam"],
        "Namakkal": ["Namakkal", "Kolli Hills", "Kumarapalayam", "Mohanur", "Paramathi Velur", "Rasipuram", "Sendamangalam", "Tiruchengode"],
        "Nilgiris": ["Udhagamandalam (Ooty)", "Coonoor", "Gudalur", "Kotagiri", "Kundah", "Pandalur"],
        "Perambalur": ["Perambalur", "Alathur", "Kunnam", "Veppanthattai"],
        "Pudukkottai": ["Pudukkottai", "Alangudi", "Aranthangi", "Avudiyarkoil", "Gandarvakottai", "Iluppur", "Karambakkudi", "Kulathur", "Manamelkudi", "Ponnamaravathi", "Thirumayam", "Viralimalai"],
        "Ramanathapuram": ["Ramanathapuram", "Kadaladi", "Kamuthi", "Kilasakarai", "Mudukulathur", "Paramakudi", "Rajasingamangalam", "Rameswaram", "Tiruvadanai"],
        "Ranipet": ["Ranipet", "Arakkonam", "Arcot", "Kalavai", "Nemili", "Sholinghur", "Walajah"],
        "Sivaganga": ["Sivaganga", "Devakottai", "Ilayangudi", "Kalaiyarkovil", "Karaikudi", "Manamadurai", "Singampunari", "Thiruppuvanam", "Tirupathur"],
        "Tenkasi": ["Tenkasi", "Alangulam", "Kadayanallur", "Sankarankovil", "Shenkottai", "Sivagiri", "Thiruvengadam", "Veerakeralamputhur"],
        "Thanjavur": ["Thanjavur", "Boothalur", "Kumbakonam", "Orathanadu", "Papanasam", "Pattukkottai", "Peravurani", "Thiruvaiyaru", "Thiruvidaimarudur"],
        "Theni": ["Theni", "Andipatti", "Bodinayakanur", "Periyakulam", "Uthamapalayam"],
        "Thoothukudi": ["Thoothukudi", "Eral", "Ettayapuram", "Kayathar", "Kovilpatti", "Ottapidaram", "Sathankulam", "Srivaikuntam", "Tiruchendur", "Vilathikulam"],
        "Tirupathur": ["Tirupathur", "Ambur", "Natrampalli", "Vaniyambadi"],
        "Tiruvallur": ["Tiruvallur", "Avadi", "Gummidipoondi", "Pallipattu", "Ponneri", "Poonamallee", "R.K. Pet", "Tiruttani", "Uthukkottai"],
        "Tiruvannamalai": ["Tiruvannamalai", "Arani", "Chengam", "Chetpet", "Cheyyar", "Jamunamarathur", "Kalasapakkam", "Kilpennathur", "Polur", "Thandarampattu", "Vandavasi", "Vembakkam"],
        "Tiruvarur": ["Tiruvarur", "Kodavasal", "Koothanallur", "Mannargudi", "Nannilam", "Needamangalam", "Thiruthuraipoondi", "Valangaiman"],
        "Viluppuram": ["Viluppuram", "Gingee", "Kandachipuram", "Marakkanam", "Melmalayanur", "Tindivanam", "Vanur", "Vikaravandi"],
        "Virudhunagar": ["Virudhunagar", "Aruppukkottai", "Kariyapatti", "Rajapalayam", "Sathur", "Sivakasi", "Srivilliputhur", "Tiruchuli", "Vembakottai", "Watrap"]
    };

    const ANDHRA_PRADESH_DISTRICTS = {
        "Anantapur": ["Anantapur", "Dharmavaram", "Guntakal", "Kalyandurg", "Rayadurg", "Tadipatri", "Urwakonda", "Pamidi"],
        "Chittoor": ["Chittoor", "Palamaner", "Kuppam", "Punganur", "Nagari", "Gudipala", "Bangarupalem"],
        "East Godavari": ["Rajahmundry Urban", "Rajahmundry Rural", "Kovvur", "Nidadavole", "Anaparthi", "Korukonda", "Rajanagaram"],
        "Guntur": ["Guntur East", "Guntur West", "Tenali", "Ponnur", "Mangalagiri", "Tadikonda", "Chebrolu", "Prathipadu"],
        "Krishna": ["Machilipatnam", "Gudivada", "Vuyyuru", "Pamarru", "Pedana", "Gannavaram", "Avanigadda"],
        "Kurnool": ["Kurnool Urban", "Kurnool Rural", "Adoni", "Yemmiganur", "Alur", "Pattikonda", "Kodumur", "Mantralayam"],
        "Nellore (SPSR Nellore)": ["Nellore Urban", "Nellore Rural", "Kavali", "Kandukur", "Atmakur", "Allur", "Kovur", "Buchireddypalem"],
        "Prakasam": ["Ongole", "Markapur", "Chirala", "Giddalur", "Kanigiri", "Podili", "Darsi", "Yerragondapalem"],
        "Sri Sathya Sai": ["Puttaparthi", "Kadiri", "Penukonda", "Hindupur", "Madakasira", "Dharmavaram", "Bukkapatnam", "Gorantla"],
        "Tirupati": ["Tirupati Urban", "Tirupati Rural", "Srikalahasti", "Chandragiri", "Sullurpeta", "Venkatagiri", "Gudur", "Naidupeta"],
        "Visakhapatnam": ["Visakhapatnam Rural", "Gajuwaka", "Bheemunipatnam", "Anandapuram", "Padmanabham", "Pendurthi", "Maharanipeta"],
        "West Godavari": ["Bhimavaram", "Tadepalligudem", "Tanuku", "Palakollu", "Narsapur", "Undi", "Akividu", "Achanta"],
        "YSR Kadapa": ["Kadapa", "Proddatur", "Pulivendula", "Jammalamadugu", "Rayachoti", "Mydukur", "Badvel", "Kamalapuram"],
        "Alluri Sitharama Raju": ["Paderu", "Araku Valley", "Rampachodavaram", "Chintapalli", "Ananthagiri", "Maredumilli"],
        "Anakapalli": ["Anakapalli", "Chodavaram", "Madugula", "Narsipatnam", "Payakaraopeta", "Elamanchili"],
        "Annamayya": ["Rayachoti", "Madanapalle", "Railway Koduru", "Rajampet", "Tamballapalle", "Valmikipuram"],
        "Bapatla": ["Bapatla", "Chirala", "Repalle", "Vemuru", "Addanki", "Karispadu"],
        "Eluru": ["Eluru", "Jangareddigudem", "Chintalapudi", "Polavaram", "Nuzvid", "Kaikalur"],
        "Kakinada": ["Kakinada Urban", "Kakinada Rural", "Pithapuram", "Samalkota", "Peddapuram", "Tuni"],
        "Konaseema (Dr. B.R. Ambedkar)": ["Amalapuram", "Razole", "Kothapeta", "Mandapeta", "Mummidivaram", "Ramachandrapuram"],
        "Nandyal": ["Nandyal", "Allagadda", "Banaganapalle", "Dhone", "Nandikotkur", "Srisailam"],
        "NTR": ["Vijayawada Urban", "Vijayawada Rural", "Mylavaram", "Nandigama", "Jaggayyapeta", "Tiruvuru"],
        "Palnadu": ["Narasaraopet", "Sattenapalle", "Vinukonda", "Gurazala", "Macherla", "Chilakaluripet"],
        "Parvathipuram Manyam": ["Parvathipuram", "Salur", "Palakonda", "Kurupam", "Gummalakshmipuram"],
        "Srikakulam": ["Srikakulam", "Amadalavalasa", "Ichchapuram", "Narasannapeta", "Palasa", "Tekkali", "Rajam"],
        "Vizianagaram": ["Vizianagaram", "Bobbili", "Cheepurupalli", "Gajapathinagaram", "Nellimarla", "Srungavarapukota"]
    };

    const TELANGANA_DISTRICTS = {
        "Hyderabad": ["Amberpet", "Asifnagar", "Bahadurpura", "Charminar", "Golconda", "Khairatabad", "Marredpally", "Musheerabad", "Secunderabad", "Shaikpet"],
        "Ranga Reddy": ["Chevella", "Ibrahimpatnam", "Rajendranagar", "Serilingampally", "Shadnagar", "Maheshwaram", "Shamshabad", "Kandukur"],
        "Medchal-Malkajgiri": ["Alwal", "Balanagar", "Ghatkesar", "Kukatpally", "Malkajgiri", "Medchal", "Quthbullapur", "Uppal"],
        "Sangareddy": ["Sangareddy", "Patancheru", "Zaheerabad", "Andole", "Narayankhed", "Ramachandrapuram", "Ameenpur", "Jinnaram"],
        "Mahabubnagar": ["Mahabubnagar Urban", "Mahabubnagar Rural", "Jadcherla", "Bhoothpur", "Devarkadra", "Nawabpet", "Hanwada"],
        "Nizamabad": ["Nizamabad North", "Nizamabad South", "Armoor", "Bodhan", "Bheemgal", "Dichpally", "Jakranpally"],
        "Warangal": ["Warangal", "Narsampet", "Wardhannapet", "Geesugonda", "Rayaparthy", "Chennaraopet"],
        "Hanamkonda": ["Hanamkonda", "Kazipet", "Parkal", "Kamalapur", "Bhimadevarapalle", "Elkathurthy", "Hasanparthy"],
        "Khammam": ["Khammam Urban", "Khammam Rural", "Kallur", "Madhira", "Sathupalli", "Wyra", "Enkoor"],
        "Karimnagar": ["Karimnagar", "Choppadandi", "Huzurabad", "Jammikunta", "Manakondur", "Gangadhara", "Veenavanka"],
        "Nalgonda": ["Nalgonda", "Miryalaguda", "Devarakonda", "Nakrekal", "Munugode", "Haliya", "Chityal"],
        "Suryapet": ["Suryapet", "Kodad", "Huzurnagar", "Thungathurthy", "Mothey", "Chivemla"],
        "Adilabad": ["Adilabad Urban", "Adilabad Rural", "Bazarhathnoor", "Boath", "Gudihathnoor", "Ichoda", "Jainath", "Utnoor"],
        "Bhadradri Kothagudem": ["Kothagudem", "Bhadrachalam", "Yellandu", "Manuguru", "Palwancha", "Burgampahad"],
        "Jagtial": ["Jagtial", "Korutla", "Metpally", "Dharmapuri", "Raikal", "Gollapalli"],
        "Jangaon": ["Jangaon", "Ghanpur (Station)", "Palakurthi", "Devaruppula", "Bachannapet"],
        "Jayashankar Bhupalpally": ["Bhupalpally", "Chityal", "Kataram", "Mahadevpur", "Regonda"],
        "Jogulamba Gadwal": ["Gadwal", "Alampur", "Ieeja", "Itikyal", "Manoor", "Waddepalle"],
        "Kamareddy": ["Kamareddy", "Banswada", "Yellareddy", "Domakonda", "Machareddy", "Pitlam"],
        "Kumuram Bheem Asifabad": ["Asifabad", "Kagaznagar", "Sirpur", "Jainoor", "Kerameri", "Rebbena"],
        "Mahabubabad": ["Mahabubabad", "Dornakal", "Kesamudram", "Maripeda", "Kuravi", "Nellikudur"],
        "Mancherial": ["Mancherial", "Bellampalli", "Chennur", "Mandamarri", "Luxettipet", "Nennal"],
        "Medak": ["Medak", "Narsapur", "Ramayampet", "Alladurg", "Chegunta", "Shankarampet"],
        "Mulugu": ["Mulugu", "Eturnagaram", "Govindaraopet", "Mangapet", "Tadvai", "Venkatapur"],
        "Nagarkurnool": ["Nagarkurnool", "Achampet", "Kalwakurthy", "Kollapur", "Telkapally", "Bijinapally"],
        "Narayanpet": ["Narayanpet", "Makthal", "Kosgi", "Maganoor", "Damaragidda", "Utkoor"],
        "Nirmal": ["Nirmal", "Bhainsa", "Khanapur", "Kaddam", "Mudhole", "Sarannagar"],
        "Peddapalli": ["Peddapalli", "Ramagundam", "Manthani", "Sultanabad", "Julapalli", "Odela"],
        "Rajanna Sircilla": ["Sircilla", "Vemulawada", "Boinpalli", "Chandurthi", "Gambhiraopet", "Mustabad"],
        "Siddipet": ["Siddipet Urban", "Siddipet Rural", "Gajwel", "Husnabad", "Dubbak", "Cherial"],
        "Vikarabad": ["Vikarabad", "Tandur", "Pargi", "Kodangal", "Nawabpet", "Mominpet"],
        "Wanaparthy": ["Wanaparthy", "Kothakota", "Pebbair", "Pangal", "Revally", "Ghanpur"],
        "Yadadri Bhuvanagiri": ["Bhongir", "Alair", "Choutuppal", "Mothkur", "Ramannapet", "Yadagirigutta"]
    };

    const KERALA_DISTRICTS = {
        "Alappuzha": ["Ambalapuzha", "Chengannur", "Cherthala", "Karthikappally", "Kuttanad", "Mavelikkara"],
        "Ernakulam": ["Aluva", "Kanayannur (Ernakulam)", "Kochi", "Kothamangalam", "Kunnathunad", "Muvattupuzha", "Paravur"],
        "Idukki": ["Devikulam", "Idukki", "Peerumade", "Thodupuzha", "Udumbanchola"],
        "Kannur": ["Kannur", "Iritty", "Payyanur", "Taliparamba", "Thalassery"],
        "Kasaragod": ["Hosdurg", "Kasaragod", "Manjeshwaram", "Vellarikundu"],
        "Kollam": ["Kollam", "Karunagappally", "Kottarakkara", "Kunnathur", "Pathanapuram", "Punalur"],
        "Kottayam": ["Changanassery", "Kanjirappally", "Kottayam", "Meenachil", "Vaikom"],
        "Kozhikode": ["Kozhikode", "Koyilandy", "Thamarassery", "Vadakara"],
        "Malappuram": ["Eranad", "Kondotty", "Nilambur", "Perinthalmanna", "Ponnani", "Tirur", "Tirurangadi"],
        "Palakkad": ["Alathur", "Chittur", "Mannarkkad", "Ottappalam", "Palakkad", "Pattambi"],
        "Pathanamthitta": ["Adoor", "Konni", "Kozhencherry", "Mallappally", "Ranni", "Thiruvalla"],
        "Thiruvananthapuram": ["Chirayinkeezhu", "Nedumangad", "Neyyattinkara", "Thiruvananthapuram", "Varkala", "Kattakada"],
        "Thrissur": ["Chalakkudy", "Chavakkad", "Kodungallur", "Mukundapuram", "Thalapilly", "Thrissur"],
        "Wayanad": ["Mananthavady", "Sulthan Bathery", "Vythiri"]
    };

    const MAHARASHTRA_DISTRICTS = {
        "Ahmednagar": ["Ahmednagar", "Akole", "Jamkhed", "Karjat", "Kopargaon", "Newasa", "Parner", "Pathardi", "Rahata", "Rahuri", "Sangamner", "Shevgaon", "Shrigonda", "Shrirampur"],
        "Akola": ["Akola", "Akot", "Balapur", "Barshitakli", "Murtizapur", "Patur", "Telhara"],
        "Amravati": ["Achalpur", "Amravati", "Anjangaon Surji", "Chandur Railway", "Chandurbazar", "Chikhaldara", "Daryapur", "Dhamangaon Railway", "Morshi", "Nandgaon-Khandeshwar", "Teosa", "Warud"],
        "Chhatrapati Sambhaji Nagar (Aurangabad)": ["Aurangabad", "Gangapur", "Kannad", "Khuldabad", "Paithan", "Phulambri", "Sillod", "Soegaon", "Vaijapur"],
        "Beed": ["Ambejogai", "Ashti", "Beed", "Georai", "Kaij", "Majalgaon", "Parli", "Patoda", "Shirur-Kasar", "Wadwani"],
        "Kolhapur": ["Ajra", "Bavda", "Bhudargad", "Chandgad", "Gadhinglaj", "Hatkanangle", "Kagal", "Karvir (Kolhapur)", "Panhala", "Radhanagari", "Shahuwadi", "Shirol"],
        "Mumbai City": ["Colaba", "Fort", "Dadar", "Mahim", "Byculla", "Parel"],
        "Mumbai Suburban": ["Andheri", "Bandra", "Borivali", "Kurla"],
        "Nagpur": ["Nagpur Urban", "Nagpur Rural", "Kamptee", "Hingna", "Katol", "Narkhed", "Savner", "Kalameshwar", "Ramtek", "Mouda", "Umred", "Kuhi", "Bhiwapur"],
        "Nashik": ["Nashik", "Baglan", "Chandwad", "Deola", "Dindori", "Igatpuri", "Kalwan", "Malegaon", "Nandgaon", "Niphad", "Peint", "Sinnar", "Surgana", "Trimbakeshwar", "Yeola"],
        "Pune": ["Pune City", "Haveli", "Khed", "Ambegaon", "Junnar", "Shirur", "Daund", "Indapur", "Baramati", "Purandar", "Bhor", "Velhe", "Maval", "Mulshi"],
        "Sangli": ["Atpadi", "Jat", "Kadegaon", "Kavathe Mahankal", "Khanapur", "Miraj", "Palus", "Shirala", "Tasgaon", "Walwa"],
        "Satara": ["Satara", "Karad", "Wai", "Mahabaleshwar", "Phaltan", "Khandala", "Khatav", "Koregaon", "Man", "Patan", "Jaoli"],
        "Solapur": ["Solapur North", "Solapur South", "Akkalkot", "Barshi", "Karmala", "Madha", "Malshiras", "Mangalvedhe", "Mohol", "Pandharpur", "Sangola"],
        "Thane": ["Thane", "Kalyan", "Murbad", "Bhiwandi", "Shahapur", "Ulhasnagar", "Ambarnath"],
        "Bhandara": ["Bhandara", "Tumsar", "Pauni", "Mohadi", "Sakoli", "Lakhani", "Lakhandur"],
        "Buldhana": ["Buldhana", "Chikhli", "Deulgaon Raja", "Jalgaon Jamod", "Khamgaon", "Lonar", "Malkapur", "Mehkar", "Motala", "Nandura", "Sangrampur", "Shegaon", "Sindkhed Raja"],
        "Chandrapur": ["Chandrapur", "Ballarpur", "Bhadravati", "Brahmapuri", "Chimur", "Gondpipri", "Jiwati", "Korpurna", "Mul", "Nagbhid", "Pombhurna", "Rajura", "Sawali", "Sindewahi", "Warora"],
        "Dhule": ["Dhule", "Sakri", "Shirpur", "Sindkheda"],
        "Gadchiroli": ["Gadchiroli", "Aheri", "Armori", "Chamorshi", "Dhanora", "Etapalli", "Kurkheda", "Korchi", "Mulchera", "Sironcha"],
        "Gondia": ["Gondia", "Tirora", "Goregaon", "Arjuni Morgaon", "Deori", "Amgaon", "Salekasa", "Sadak Arjuni"],
        "Hingoli": ["Hingoli", "Aundha Nagnath", "Basmath", "Kalamnuri", "Sengaon"],
        "Jalgaon": ["Jalgaon", "Amalner", "Bhadgaon", "Bhusawal", "Bodwad", "Chalisgaon", "Chopda", "Dharangaon", "Erandol", "Jamner", "Muktainagar", "Pachora", "Parola", "Raver", "Yawal"],
        "Jalna": ["Jalna", "Ambad", "Badnapur", "Bhokardan", "Ghansawangi", "Jafrabad", "Mantha", "Partur"],
        "Latur": ["Latur", "Ahmadpur", "Ausa", "Chakur", "Deoni", "Jalkot", "Renapur", "Shirur Anantpal", "Udgir"],
        "Nanded": ["Nanded", "Ardhapur", "Bhokar", "Biloli", "Deglur", "Dharmabad", "Hadgaon", "Himayatnagar", "Kandhar", "Kinwat", "Loha", "Mahoor", "Mudkhed", "Mukhed", "Naigaon", "Umri"],
        "Nandurbar": ["Nandurbar", "Akkalkuwa", "Akrani", "Navapur", "Shahada", "Talode"],
        "Dharashiv (Osmanabad)": ["Osmanabad", "Bhoom", "Kalamb", "Lohara", "Paranda", "Tuljapur", "Umarga", "Washi"],
        "Palghar": ["Palghar", "Dahanu", "Jawhar", "Mokhada", "Talasari", "Vada", "Vasai", "Vikramgad"],
        "Parbhani": ["Parbhani", "Gangakhed", "Jintur", "Manwath", "Palam", "Pathri", "Purna", "Sailu", "Sonpeth"],
        "Raigad": ["Alibag", "Karjat", "Khalapur", "Mahad", "Mangaon", "Mhasla", "Murud", "Panvel", "Pen", "Poladpur", "Roha", "Shrivardhan", "Sudhagad", "Tala", "Uran"],
        "Ratnagiri": ["Ratnagiri", "Chiplun", "Dapoli", "Guhagar", "Khed", "Lanja", "Mandangad", "Rajapur", "Sangameshwar"],
        "Sindhudurg": ["Kankavli", "Kudal", "Malvan", "Devgad", "Sawantwadi", "Vengurla", "Vaibhavwadi", "Dodamarg"],
        "Wardha": ["Wardha", "Arvi", "Ashti", "Deoli", "Hinganghat", "Karanja", "Samudrapur", "Seloo"],
        "Washim": ["Washim", "Karanja", "Malegaon", "Mangrulpir", "Manora", "Risod"],
        "Yavatmal": ["Yavatmal", "Arni", "Babhulgaon", "Darwha", "Digras", "Ghatanji", "Kalamb", "Kelapur", "Mahagaon", "Maregaon", "Ner", "Pusad", "Ralegaon", "Umarkhed", "Wani", "Zari-Jamani"]
    };

    // Other states with major districts and fallback tehsils
    const OTHER_STATES = {
        "Gujarat": {
            "Ahmedabad": ["Ahmedabad City", "Daskroi", "Sanand", "Dholka", "Bavla", "Dhandhuka", "Viramgam", "Mandal"],
            "Surat": ["Surat City", "Chorasi", "Olpad", "Kamrej", "Bardoli", "Mahuva", "Mandvi"],
            "Vadodara": ["Vadodara", "Padra", "Karjan", "Savli", "Vaghodia", "Dabhoi", "Sinor"],
            "Rajkot": ["Rajkot", "Gondal", "Jetpur", "Dhoraji", "Upleta", "Morbi", "Jasdan"],
            "Bhavnagar": ["Bhavnagar", "Sihor", "Palitana", "Gariadhar", "Talaja", "Mahuva"],
            "Jamnagar": ["Jamnagar", "Jodiya", "Dhrol", "Kalavad", "Lalpur", "Jamjodhpur"],
            "Junagadh": ["Junagadh", "Keshod", "Mangrol", "Malia", "Manavadar", "Visavadar"],
            "Amreli": ["Amreli", "Babra", "Dhari", "Kunkavav", "Lathi", "Rajula", "Savarkundla"],
            "Anand": ["Anand", "Anklav", "Borsad", "Khambhat", "Petlad", "Sojitra", "Tarapur", "Umreth"],
            "Banaskantha": ["Palanpur", "Deesa", "Dhanera", "Tharad", "Vav", "Danta", "Vadgam", "Kankrej"],
            "Bharuch": ["Bharuch", "Ankleshwar", "Jambusar", "Hansot", "Amod", "Vagra", "Valia"],
            "Kheda": ["Nadiad", "Kheda", "Kapadvanj", "Matar", "Mahudha", "Thasra", "Kathlal"],
            "Mehsana": ["Mehsana", "Visnagar", "Vadnagar", "Kadi", "Unjha", "Vijapur", "Satlasana"],
            "Patan": ["Patan", "Chanasma", "Harij", "Radhanpur", "Sami", "Sidhpur"],
            "Sabarkantha": ["Himatnagar", "Idar", "Prantij", "Talod", "Khedbrahma", "Vadali"],
            "Valsad": ["Valsad", "Dharampur", "Pardi", "Umbergaon", "Kaprada", "Vapi"]
        },
        "Madhya Pradesh": {
            "Bhopal": ["Huzur", "Berasia", "Kolar"],
            "Indore": ["Indore", "Mhow", "Depalpur", "Sanwer", "Hatod"],
            "Jabalpur": ["Jabalpur", "Patan", "Sihora", "Kundam", "Panagar", "Shahpura"],
            "Gwalior": ["Gwalior", "Dabra", "Bhitarwar", "Chinour"],
            "Ujjain": ["Ujjain", "Nagda", "Badnagar", "Mahidpur", "Tarana", "Khachrod"],
            "Sagar": ["Sagar", "Banda", "Bina", "Deori", "Khurai", "Rahatgarh"],
            "Rewa": ["Rewa", "Huzur", "Hanumana", "Mauganj", "Semariya", "Sirmaur", "Teonthar"],
            "Satna": ["Satna", "Amarpatan", "Maihar", "Nagod", "Raghurajnagar", "Ramnagar", "Uchehara"],
            "Dhar": ["Dhar", "Badnawar", "Kukshi", "Manawar", "Sardarpur"],
            "Khargone": ["Khargone", "Barwaha", "Bhikangaon", "Kasrawad", "Maheshwar", "Segaon"]
        },
        "Rajasthan": {
            "Jaipur": ["Jaipur", "Amer", "Sanganer", "Basssi", "Chaksu", "Kotputli", "Phulera", "Shahpura"],
            "Jodhpur": ["Jodhpur", "Bilara", "Bhopalgarh", "Luni", "Osian", "Phalodi", "Shergarh"],
            "Udaipur": ["Udaipur", "Girwa", "Gogunda", "Jhadol", "Kherwara", "Kotra", "Mavli", "Salumber", "Vallabhnagar"],
            "Kota": ["Kota", "Digod", "Ladpura", "Pipalda", "Ramganj Mandi", "Sangod"],
            "Bikaner": ["Bikaner", "Kolayat", "Lunkaransar", "Nokha", "Poogal", "Khajuwala"],
            "Ajmer": ["Ajmer", "Beawar", "Kishangarh", "Nasirabad", "Peesangan", "Sarwar"],
            "Alwar": ["Alwar", "Behror", "Bhiwadi", "Kathumar", "Kishangarh Bas", "Kotkasim", "Laxmangarh", "Rajgarh", "Ramgarh", "Thanagazi", "Tijara"],
            "Bhilwara": ["Bhilwara", "Asind", "Banera", "Hurda", "Jahazpur", "Kotri", "Mandal", "Mandalgarh", "Raipur", "Sahada", "Shahpura"]
        },
        "Uttar Pradesh": {
            "Lucknow": ["Lucknow", "Bakshi Ka Talab", "Malihabad", "Mohanlalganj", "Sarojini Nagar"],
            "Kanpur Nagar": ["Kanpur Sadar", "Bilhaur", "Ghatampur"],
            "Varanasi": ["Varanasi Sadar", "Pindra"],
            "Agra": ["Agra", "Etmadpur", "Fatehabad", "Kheragarh", "Bah"],
            "Prayagraj (Allahabad)": ["Sadar", "Bara", "Handia", "Karchhana", "Koraon", "Meja", "Phulpur", "Soraon"],
            "Meerut": ["Meerut", "Mawana", "Sardhana"],
            "Ghaziabad": ["Ghaziabad", "Modinagar", "Loni"],
            "Gautam Buddha Nagar (Noida)": ["Dadri", "Jewar", "Sadar (Noida)"],
            "Bareilly": ["Bareilly", "Aonla", "Baheri", "Faridpur", "Mirganj", "Nawabganj"],
            "Aligarh": ["Koil (Aligarh)", "Atrauli", "Gabhaana", "Iglas", "Khair"],
            "Moradabad": ["Moradabad", "Bilari", "Kanth", "Thakurdwara"],
            "Gorakhpur": ["Gorakhpur Sadar", "Bansgaon", "Campierganj", "Chauri Chaura", "Gola", "Khajni", "Sahjanwa"]
        },
        "Goa": {
            "North Goa": ["Bardez", "Bicholim", "Pernem", "Sattari", "Tiswadi"],
            "South Goa": ["Canacona", "Mormugao", "Salcete", "Sanguem", "Quepem", "Dharbandora"]
        },
        "Punjab": {
            "Amritsar": ["Amritsar I", "Amritsar II", "Ajnala", "Baba Bakala", "Majitha"],
            "Ludhiana": ["Ludhiana East", "Ludhiana West", "Jagraon", "Khanna", "Payal", "Raikot", "Samrala"],
            "Jalandhar": ["Jalandhar I", "Jalandhar II", "Nakodar", "Phillaur", "Shahkot"],
            "Patiala": ["Patiala", "Dhudan Sadhan", "Nabha", "Patran", "Rajpura", "Samana"],
            "Bathinda": ["Bathinda", "Maur", "Rampura Phul", "Talwandi Sabo"]
        },
        "Haryana": {
            "Gurugram (Gurgaon)": ["Gurugram", "Badshahpur", "Farrukhnagar", "Manesar", "Pataudi", "Sohna"],
            "Faridabad": ["Faridabad", "Ballabgarh", "Badkhal"],
            "Ambala": ["Ambala", "Barara", "Naraingarh", "Saha"],
            "Hisar": ["Hisar", "Adampur", "Barwala", "Bass", "Hansi", "Narnaund", "Uklana"],
            "Karnal": ["Karnal", "Assandh", "Gharaunda", "Indri", "Nilokheri"],
            "Panipat": ["Panipat", "Israna", "Madlauda", "Samalkha", "Bapoli"]
        },
        "West Bengal": {
            "Kolkata": ["Alipore", "Kolkata North", "Kolkata South"],
            "North 24 Parganas": ["Barasat", "Barrackpore", "Bangaon", "Basirhat", "Bidhannagar"],
            "South 24 Parganas": ["Alipore Sadar", "Baruipur", "Canning", "Diamond Harbour", "Kakdwip"],
            "Howrah": ["Howrah Sadar", "Uluberia"],
            "Hooghly": ["Chinsurah", "Chandannagar", "Serampore", "Arambagh"],
            "Darjeeling": ["Darjeeling Sadar", "Kurseong", "Mirik"],
            "Murshidabad": ["Berhampore", "Domkal", "Jangipur", "Kandi", "Lalbag"]
        },
        "Bihar": {
            "Patna": ["Patna Sadar", "Barh", "Danapur", "Masaurhi", "Mokama", "Paliganj"],
            "Gaya": ["Gaya Sadar", "Sherghati", "Tekari", "Neemchak Bathani"],
            "Muzaffarpur": ["Muzaffarpur East", "Muzaffarpur West"],
            "Bhagalpur": ["Bhagalpur Sadar", "Kahalgaon", "Naugachhia"],
            "Darbhanga": ["Darbhanga Sadar", "Benipur", "Biraul"]
        },
        "Delhi (NCT)": {
            "Central Delhi": ["Civil Lines", "Karol Bagh", "Kotwali"],
            "East Delhi": ["Gandhi Nagar", "Preet Vihar", "Mayur Vihar"],
            "New Delhi": ["Chanakyapuri", "Connaught Place", "Delhi Cantonment"],
            "North Delhi": ["Alipur", "Model Town", "Narela"],
            "North East Delhi": ["Karawal Nagar", "Seelampur", "Yamuna Vihar"],
            "North West Delhi": ["Kanjhawala", "Rohini", "Saraswati Vihar"],
            "South Delhi": ["Hauz Khas", "Mehrauli", "Saket"],
            "South East Delhi": ["Defence Colony", "Kalkaji", "Sarita Vihar"],
            "South West Delhi": ["Dwarka", "Kapashera", "Najafgarh"],
            "West Delhi": ["Patel Nagar", "Punjabi Bagh", "Rajouri Garden"]
        }
    };

    // All Indian States & Union Territories
    const ALL_STATES = [
        "Karnataka",
        "Tamil Nadu",
        "Andhra Pradesh",
        "Telangana",
        "Kerala",
        "Maharashtra",
        "Gujarat",
        "Madhya Pradesh",
        "Rajasthan",
        "Uttar Pradesh",
        "Goa",
        "Punjab",
        "Haryana",
        "West Bengal",
        "Bihar",
        "Delhi (NCT)",
        "Odisha",
        "Assam",
        "Chhattisgarh",
        "Jharkhand",
        "Uttarakhand",
        "Himachal Pradesh",
        "Jammu and Kashmir",
        "Ladakh",
        "Chandigarh",
        "Puducherry",
        "Andaman and Nicobar Islands",
        "Arunachal Pradesh",
        "Dadra and Nagar Haveli and Daman and Diu",
        "Lakshadweep",
        "Manipur",
        "Meghalaya",
        "Mizoram",
        "Nagaland",
        "Sikkim",
        "Tripura"
    ];

    // Build the master INDIA_LOCATIONS map
    const masterLocations = {};

    masterLocations["Karnataka"] = KARNATAKA_DISTRICTS;
    masterLocations["Tamil Nadu"] = TAMIL_NADU_DISTRICTS;
    masterLocations["Andhra Pradesh"] = ANDHRA_PRADESH_DISTRICTS;
    masterLocations["Telangana"] = TELANGANA_DISTRICTS;
    masterLocations["Kerala"] = KERALA_DISTRICTS;
    masterLocations["Maharashtra"] = MAHARASHTRA_DISTRICTS;

    for (const [st, dists] of Object.entries(OTHER_STATES)) {
        masterLocations[st] = dists;
    }

    // Ensure all other states are in masterLocations (fallback array of districts if not yet mapped)
    ALL_STATES.forEach(st => {
        if (!masterLocations[st]) {
            masterLocations[st] = {};
        }
    });

    // Normalizer helper: find key in object case-insensitively or via alias
    function findKeyCaseInsensitive(obj, query) {
        if (!obj || !query) return null;
        const qClean = String(query).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!qClean) return null;

        // 1. Direct match
        for (const k of Object.keys(obj)) {
            const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (kClean === qClean) return k;
        }

        // 2. Contains match (e.g. query "Tumkur" matches "Tumakuru (Tumkur)")
        for (const k of Object.keys(obj)) {
            const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (kClean.includes(qClean) || qClean.includes(kClean)) return k;
        }

        return null;
    }

    // Location API
    const LocationService = {
        getStates: function () {
            return ALL_STATES;
        },

        getDistricts: function (stateName) {
            if (!stateName) return [];
            const matchedState = findKeyCaseInsensitive(masterLocations, stateName);
            if (!matchedState || !masterLocations[matchedState]) return [];
            return Object.keys(masterLocations[matchedState]);
        },

        getTaluks: function (stateName, districtName) {
            if (!stateName || !districtName) return [];
            const matchedState = findKeyCaseInsensitive(masterLocations, stateName);
            if (!matchedState || !masterLocations[matchedState]) return [];

            const distMap = masterLocations[matchedState];
            const matchedDist = findKeyCaseInsensitive(distMap, districtName);
            if (!matchedDist || !distMap[matchedDist]) return [];

            const taluks = distMap[matchedDist];
            return Array.isArray(taluks) ? taluks : Object.keys(taluks);
        },

        normalizeState: function (state) {
            if (!state) return 'Karnataka';
            // Common variations
            const clean = state.trim().toLowerCase();
            if (clean === 'ka' || clean === 'karanataka') return 'Karnataka';
            if (clean.includes('tamil') || clean === 'tn') return 'Tamil Nadu';
            if (clean.includes('andra') || clean.includes('andhra') || clean === 'ap') return 'Andhra Pradesh';
            if (clean.includes('telangana') || clean === 'ts') return 'Telangana';
            if (clean.includes('kerala') || clean === 'kl') return 'Kerala';
            if (clean.includes('maharashtra') || clean.includes('maharastra') || clean === 'mh') return 'Maharashtra';
            
            const found = findKeyCaseInsensitive(masterLocations, state);
            return found || state;
        },

        normalizeDistrict: function (stateName, districtName) {
            if (!districtName) return '';
            const matchedState = findKeyCaseInsensitive(masterLocations, stateName || 'Karnataka');
            if (!matchedState) return districtName;
            const distMap = masterLocations[matchedState] || {};
            const found = findKeyCaseInsensitive(distMap, districtName);
            return found || districtName;
        }
    };

    window.INDIA_LOCATIONS = masterLocations;
    window.LocationService = LocationService;

    // ============================================================
    // Searchable Combobox Controller
    // Converts input + dropdown into an interactive, typeable, tap-to-select combobox
    // ============================================================
    window.initSearchableCombobox = function (inputId, dropdownId, getOptionsFn, onSelectCallback) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        if (!input || !dropdown) return;

        let activeIndex = -1;

        function renderList(filterText = '') {
            const options = getOptionsFn() || [];
            const cleanFilter = (filterText || '').trim().toLowerCase();
            
            let filtered = options;
            if (cleanFilter) {
                filtered = options.filter(opt => {
                    const str = String(opt).toLowerCase();
                    return str.includes(cleanFilter);
                });
            }

            if (filtered.length === 0) {
                dropdown.innerHTML = `<div style="padding:0.65rem 1rem; color:#94a3b8; font-size:0.85rem; font-style:italic;">No matches found (custom entry accepted)</div>`;
                dropdown.style.display = 'block';
                return;
            }

            const currentVal = (input.value || '').trim().toLowerCase();
            let html = '';
            filtered.forEach((opt, idx) => {
                const isSelected = String(opt).toLowerCase() === currentVal;
                const bg = isSelected ? '#dcfce7' : 'transparent';
                const color = isSelected ? '#15803d' : '#1e293b';
                const fw = isSelected ? '700' : '500';
                html += `
                    <div class="de-combobox-item" data-index="${idx}" data-val="${opt.replace(/"/g, '&quot;')}" 
                         style="padding:0.65rem 1rem; font-size:0.875rem; color:${color}; font-weight:${fw}; cursor:pointer; border-bottom:1px solid #f1f5f9; background:${bg}; transition:all 0.12s ease;">
                        ${opt}
                    </div>
                `;
            });

            dropdown.innerHTML = html;
            dropdown.style.display = 'block';
            activeIndex = -1;

            // Attach item clicks
            dropdown.querySelectorAll('.de-combobox-item').forEach(el => {
                el.addEventListener('mouseenter', () => {
                    el.style.background = '#f0fdf4';
                    el.style.color = '#166534';
                });
                el.addEventListener('mouseleave', () => {
                    const isSel = el.getAttribute('data-val').toLowerCase() === (input.value || '').trim().toLowerCase();
                    el.style.background = isSel ? '#dcfce7' : 'transparent';
                    el.style.color = isSel ? '#15803d' : '#1e293b';
                });
                el.addEventListener('mousedown', (e) => {
                    // mousedown prevents blur from firing first
                    e.preventDefault();
                    selectValue(el.getAttribute('data-val'));
                });
            });
        }

        function selectValue(val) {
            input.value = val;
            dropdown.style.display = 'none';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof onSelectCallback === 'function') {
                onSelectCallback(val);
            }
        }

        // Input listeners
        input.addEventListener('focus', () => {
            renderList(input.value);
        });

        input.addEventListener('input', () => {
            renderList(input.value);
            if (typeof onSelectCallback === 'function') {
                onSelectCallback(input.value);
            }
        });

        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.de-combobox-item');
            if (dropdown.style.display === 'none' || items.length === 0) {
                if (e.key === 'ArrowDown') {
                    renderList(input.value);
                    e.preventDefault();
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, items.length - 1);
                updateHighlight(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                updateHighlight(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0 && items[activeIndex]) {
                    selectValue(items[activeIndex].getAttribute('data-val'));
                } else if (items.length > 0) {
                    selectValue(items[0].getAttribute('data-val'));
                }
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
            }
        });

        function updateHighlight(items) {
            items.forEach((item, idx) => {
                if (idx === activeIndex) {
                    item.style.background = '#10b981';
                    item.style.color = '#ffffff';
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.style.background = 'transparent';
                    item.style.color = '#1e293b';
                }
            });
        }

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        // Toggle button / arrow click
        const wrap = input.closest('.searchable-combobox-wrap');
        if (wrap) {
            wrap.addEventListener('click', (e) => {
                if (e.target !== input) {
                    input.focus();
                    if (dropdown.style.display === 'none' || !dropdown.style.display) {
                        renderList('');
                    } else {
                        dropdown.style.display = 'none';
                    }
                }
            });
        }
    };
})();
