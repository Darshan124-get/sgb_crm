// ============================================================
// india_locations.dart — Comprehensive Indian Locations Dataset
// SGB Connect CRM — State -> District -> Taluk cascading service
// ============================================================

class IndiaLocations {
  IndiaLocations._();

  static const List<String> states = [
    'Karnataka',
    'Tamil Nadu',
    'Andhra Pradesh',
    'Telangana',
    'Kerala',
    'Maharashtra',
    'Gujarat',
    'Madhya Pradesh',
    'Rajasthan',
    'Uttar Pradesh',
    'Goa',
    'Punjab',
    'Haryana',
    'West Bengal',
    'Bihar',
    'Delhi (NCT)',
    'Odisha',
    'Assam',
    'Chhattisgarh',
    'Jharkhand',
    'Uttarakhand',
    'Himachal Pradesh',
    'Jammu and Kashmir',
    'Ladakh',
    'Chandigarh',
    'Puducherry',
    'Andaman and Nicobar Islands',
    'Arunachal Pradesh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Lakshadweep',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Sikkim',
    'Tripura',
  ];

  static const Map<String, List<String>> karnatakaDistricts = {
    'Bagalkot': ['Bagalkot', 'Badami', 'Bilgi', 'Guledgudda', 'Hunagund', 'Ilkal', 'Jamkhandi', 'Mudhol', 'Rabkavi Banhatti'],
    'Ballari (Bellary)': ['Ballari', 'Kampli', 'Kurugodu', 'Sandur', 'Siruguppa'],
    'Belagavi (Belgaum)': ['Athani', 'Bailhongal', 'Belagavi', 'Chikkodi', 'Gokak', 'Hukkeri', 'Kagawad', 'Khanapur', 'Kittur', 'Mudalgi', 'Nippani', 'Ramdurg', 'Raybag', 'Saundatti'],
    'Bengaluru Rural': ['Devanahalli', 'Doddaballapura', 'Hoskote', 'Nelamangala'],
    'Bengaluru Urban': ['Anekal', 'Bengaluru North', 'Bengaluru South', 'Bengaluru East', 'Yelahanka'],
    'Bidar': ['Aurad', 'Basavakalyan', 'Bhalki', 'Bidar', 'Homnabad', 'Hulsoor', 'Kamalnagar'],
    'Chamarajanagar': ['Chamarajanagar', 'Gundlupet', 'Hanur', 'Kollegal', 'Yelandur'],
    'Chikkaballapura': ['Bagepalli', 'Chelur', 'Chikkaballapura', 'Chintamani', 'Gauribidanur', 'Gudibanda', 'Sidlaghatta'],
    'Chikkamagaluru (Chikmagalur)': ['Ajjampura', 'Chikkamagaluru', 'Kadur', 'Kalasa', 'Koppa', 'Mudigere', 'Narasimharajapura', 'Sringeri', 'Tarikere'],
    'Chitradurga': ['Challakere', 'Chitradurga', 'Hiriyur', 'Holalkere', 'Hosadurga', 'Molakalmuru'],
    'Dakshina Kannada (Mangalore)': ['Bantwal', 'Belthangady', 'Kadaba', 'Mangaluru', 'Moodabidri', 'Puttur', 'Sullia'],
    'Davanagere': ['Channagiri', 'Davanagere', 'Harihara', 'Honnali', 'Nyamathi'],
    'Dharwad': ['Alnavar', 'Annigeri', 'Dharwad', 'Hubballi Rural', 'Hubballi Urban', 'Kundgol', 'Navalgund'],
    'Gadag': ['Gadag', 'Gajendragad', 'Lakshmeshwar', 'Mundargi', 'Nargund', 'Ron', 'Shirahatti'],
    'Hassan': ['Alur', 'Arkalgud', 'Arsikere', 'Belur', 'Channarayapatna', 'Hassan', 'Holenarasipura', 'Sakleshpur'],
    'Haveri': ['Byadgi', 'Hangal', 'Haveri', 'Hirekerur', 'Ranebennur', 'Rattihalli', 'Savanur', 'Shiggaon'],
    'Kalaburagi (Gulbarga)': ['Afzalpur', 'Aland', 'Chincholi', 'Chitapur', 'Jevargi', 'Kalaburagi', 'Kalgi', 'Kamalapur', 'Sedam', 'Shahabad', 'Yadrav'],
    'Kodagu (Coorg)': ['Kushalnagar', 'Madikeri', 'Ponnampet', 'Somwarpet', 'Virajpet'],
    'Kolar': ['Bangarapet', 'KGF', 'Kolar', 'Malur', 'Mulbagal', 'Srinivaspur'],
    'Koppal': ['Gangavathi', 'Kanakagiri', 'Karatagi', 'Koppal', 'Kukanoor', 'Kushtagi', 'Yelburga'],
    'Mandya': ['Krishnarajpet', 'Maddur', 'Malavalli', 'Mandya', 'Nagamangala', 'Pandavapura', 'Srirangapatna'],
    'Mysuru (Mysore)': ['Heggadadevankote', 'Hunsur', 'Krishnarajanagara', 'Mysuru', 'Nanjangud', 'Piriyapatna', 'Saligrama', 'Saragur', 'T. Narasipura'],
    'Raichur': ['Deodurg', 'Lingsugur', 'Manvi', 'Maski', 'Raichur', 'Sindhanur', 'Sirwar'],
    'Ramanagara': ['Channapatna', 'Harohalli', 'Kanakapura', 'Magadi', 'Ramanagara'],
    'Shivamogga (Shimoga)': ['Bhadravathi', 'Hosanagara', 'Sagara', 'Shikaripura', 'Shivamogga', 'Soraba', 'Thirthahalli'],
    'Tumakuru (Tumkur)': ['Chiknayakanhalli', 'Gubbi', 'Koratagere', 'Kunigal', 'Madhugiri', 'Pavagada', 'Sira', 'Tiptur', 'Tumakuru', 'Turuvekere'],
    'Udupi': ['Brahmavara', 'Byndoor', 'Hebri', 'Karkala', 'Kaup', 'Kundapura', 'Udupi'],
    'Uttara Kannada (Karwar)': ['Ankola', 'Bhatkal', 'Dandeli', 'Haliyal', 'Honnavar', 'Joida', 'Karwar', 'Kumta', 'Mundgod', 'Siddapur', 'Sirsi', 'Yellapur'],
    'Vijayanagara': ['Hagaribommanahalli', 'Harapanahalli', 'Hoovina Hadagali', 'Hosapete', 'Kotturu', 'Kudligi'],
    'Vijayapura (Bijapur)': ['Babaleshwar', 'Basavana Bagewadi', 'Chadchan', 'Devara Hippargi', 'Indi', 'Kolhar', 'Muddebihal', 'Nidagundi', 'Sindagi', 'Talikoti', 'Tikota', 'Vijayapura'],
    'Yadgir': ['Gurmitkal', 'Hunasagi', 'Shahapur', 'Shorapur', 'Vadagera', 'Yadgir'],
  };

  static const Map<String, List<String>> tamilNaduDistricts = {
    'Chennai': ['Egmore', 'Guindy', 'Mylapore', 'Tondiarpet', 'Velachery', 'Aminjikarai', 'Ayanavaram', 'Perambur', 'Purasawalkam'],
    'Coimbatore': ['Coimbatore North', 'Coimbatore South', 'Pollachi', 'Mettupalayam', 'Sulur', 'Valparai', 'Annur', 'Kinathukadavu', 'Madukkarai'],
    'Dharmapuri': ['Dharmapuri', 'Harur', 'Palakkodu', 'Pennagaram', 'Karimangalam', 'Nallampalli', 'Pappireddipatti'],
    'Dindigul': ['Dindigul East', 'Dindigul West', 'Palani', 'Kodaikanal', 'Natham', 'Nilakottai', 'Oddanchatram', 'Vedasandur', 'Athoor', 'Gujiliamparai'],
    'Erode': ['Erode', 'Bhavani', 'Gobichettipalayam', 'Perundurai', 'Sathyamangalam', 'Anthiyur', 'Kodumudi', 'Modakkurichi', 'Thalavadi'],
    'Krishnagiri': ['Krishnagiri', 'Hosur', 'Pochampalli', 'Uthangarai', 'Denkanikottai', 'Bargur', 'Shoolagiri', 'Anchetty'],
    'Madurai': ['Madurai North', 'Madurai South', 'Melur', 'Thirumangalam', 'Usilampatti', 'Vadipatti', 'Peraiyur', 'Madurai East', 'Madurai West'],
    'Salem': ['Salem', 'Attur', 'Mettur', 'Omalur', 'Edappadi', 'Gangavalli', 'Sankari', 'Valapady', 'Yercaud'],
    'Tiruchirappalli': ['Tiruchirappalli East', 'Tiruchirappalli West', 'Manapparai', 'Musiri', 'Lalgudi', 'Thuraiyur', 'Srirangam'],
    'Tirunelveli': ['Tirunelveli', 'Ambasamudram', 'Nanguneri', 'Palayamkottai', 'Radhapuram', 'Cheranmahadevi'],
    'Tiruppur': ['Tiruppur North', 'Tiruppur South', 'Avinashi', 'Dharapuram', 'Kangeyam', 'Udumalaipettai', 'Madathukulam'],
    'Vellore': ['Vellore', 'Katpadi', 'Gudiyatham', 'Anaicut', 'K.V. Kuppam', 'Pernambut'],
    'Ariyalur': ['Ariyalur', 'Sendurai', 'Udayarpalayam'],
    'Chengalpattu': ['Chengalpattu', 'Cheyyur', 'Maduranthakam', 'Tambaram'],
    'Cuddalore': ['Cuddalore', 'Chidambaram', 'Panruti', 'Vriddhachalam'],
    'Kallakurichi': ['Kallakurichi', 'Chinnasalem', 'Sankarapuram', 'Ulundurpet'],
    'Kanchipuram': ['Kanchipuram', 'Kundrathur', 'Sriperumbudur', 'Uthiramerur'],
    'Kanyakumari': ['Agastheeswaram', 'Kalkulam', 'Killiyoor', 'Thovalai'],
    'Karur': ['Karur', 'Aravakurichi', 'Kulithalai', 'Pugalur'],
    'Mayiladuthurai': ['Mayiladuthurai', 'Kuthalam', 'Sirkazhi', 'Tharangambadi'],
    'Nagapattinam': ['Nagapattinam', 'Kilvelur', 'Vedaranyam'],
    'Namakkal': ['Namakkal', 'Kolli Hills', 'Paramathi Velur', 'Rasipuram', 'Tiruchengode'],
    'Nilgiris': ['Udhagamandalam (Ooty)', 'Coonoor', 'Gudalur', 'Kotagiri'],
    'Perambalur': ['Perambalur', 'Alathur', 'Kunnam', 'Veppanthattai'],
    'Pudukkottai': ['Pudukkottai', 'Alangudi', 'Aranthangi', 'Thirumayam'],
    'Ramanathapuram': ['Ramanathapuram', 'Paramakudi', 'Rameswaram'],
    'Ranipet': ['Ranipet', 'Arakkonam', 'Arcot', 'Walajah'],
    'Sivaganga': ['Sivaganga', 'Devakottai', 'Karaikudi', 'Manamadurai'],
    'Tenkasi': ['Tenkasi', 'Alangulam', 'Kadayanallur', 'Sankarankovil'],
    'Thanjavur': ['Thanjavur', 'Kumbakonam', 'Pattukkottai', 'Thiruvaiyaru'],
    'Theni': ['Theni', 'Andipatti', 'Bodinayakanur', 'Periyakulam'],
    'Thoothukudi': ['Thoothukudi', 'Kovilpatti', 'Tiruchendur'],
    'Tirupathur': ['Tirupathur', 'Ambur', 'Vaniyambadi'],
    'Tiruvallur': ['Tiruvallur', 'Avadi', 'Ponneri', 'Poonamallee'],
    'Tiruvannamalai': ['Tiruvannamalai', 'Arani', 'Chengam', 'Polur'],
    'Tiruvarur': ['Tiruvarur', 'Mannargudi', 'Nannilam'],
    'Viluppuram': ['Viluppuram', 'Gingee', 'Tindivanam'],
    'Virudhunagar': ['Virudhunagar', 'Aruppukkottai', 'Rajapalayam', 'Sivakasi'],
  };

  static const Map<String, List<String>> andhraPradeshDistricts = {
    'Anantapur': ['Anantapur', 'Dharmavaram', 'Guntakal', 'Kalyandurg', 'Rayadurg', 'Tadipatri', 'Urwakonda'],
    'Chittoor': ['Chittoor', 'Palamaner', 'Kuppam', 'Punganur', 'Nagari'],
    'East Godavari': ['Rajahmundry Urban', 'Rajahmundry Rural', 'Kovvur', 'Nidadavole', 'Anaparthi'],
    'Guntur': ['Guntur East', 'Guntur West', 'Tenali', 'Ponnur', 'Mangalagiri'],
    'Krishna': ['Machilipatnam', 'Gudivada', 'Vuyyuru', 'Pamarru', 'Gannavaram'],
    'Kurnool': ['Kurnool Urban', 'Kurnool Rural', 'Adoni', 'Yemmiganur', 'Alur', 'Pattikonda'],
    'Nellore (SPSR Nellore)': ['Nellore Urban', 'Nellore Rural', 'Kavali', 'Kandukur', 'Atmakur'],
    'Prakasam': ['Ongole', 'Markapur', 'Chirala', 'Giddalur', 'Kanigiri'],
    'Sri Sathya Sai': ['Puttaparthi', 'Kadiri', 'Penukonda', 'Hindupur', 'Madakasira'],
    'Tirupati': ['Tirupati Urban', 'Tirupati Rural', 'Srikalahasti', 'Chandragiri', 'Sullurpeta', 'Gudur'],
    'Visakhapatnam': ['Visakhapatnam Rural', 'Gajuwaka', 'Bheemunipatnam', 'Pendurthi'],
    'West Godavari': ['Bhimavaram', 'Tadepalligudem', 'Tanuku', 'Palakollu', 'Narsapur'],
    'YSR Kadapa': ['Kadapa', 'Proddatur', 'Pulivendula', 'Jammalamadugu', 'Rayachoti'],
    'Alluri Sitharama Raju': ['Paderu', 'Araku Valley', 'Rampachodavaram'],
    'Anakapalli': ['Anakapalli', 'Chodavaram', 'Narsipatnam'],
    'Annamayya': ['Rayachoti', 'Madanapalle', 'Rajampet'],
    'Bapatla': ['Bapatla', 'Chirala', 'Repalle'],
    'Eluru': ['Eluru', 'Jangareddigudem', 'Nuzvid'],
    'Kakinada': ['Kakinada Urban', 'Kakinada Rural', 'Pithapuram', 'Samalkota'],
    'Konaseema (Dr. B.R. Ambedkar)': ['Amalapuram', 'Razole', 'Mandapeta'],
    'Nandyal': ['Nandyal', 'Allagadda', 'Dhone'],
    'NTR': ['Vijayawada Urban', 'Vijayawada Rural', 'Mylavaram', 'Jaggayyapeta'],
    'Palnadu': ['Narasaraopet', 'Sattenapalle', 'Vinukonda'],
    'Parvathipuram Manyam': ['Parvathipuram', 'Salur'],
    'Srikakulam': ['Srikakulam', 'Amadalavalasa', 'Palasa', 'Tekkali'],
    'Vizianagaram': ['Vizianagaram', 'Bobbili', 'Cheepurupalli'],
  };

  static const Map<String, List<String>> telanganaDistricts = {
    'Hyderabad': ['Amberpet', 'Asifnagar', 'Bahadurpura', 'Charminar', 'Golconda', 'Khairatabad', 'Secunderabad'],
    'Ranga Reddy': ['Chevella', 'Ibrahimpatnam', 'Rajendranagar', 'Serilingampally', 'Shadnagar', 'Shamshabad'],
    'Medchal-Malkajgiri': ['Alwal', 'Balanagar', 'Ghatkesar', 'Kukatpally', 'Malkajgiri', 'Medchal', 'Quthbullapur', 'Uppal'],
    'Sangareddy': ['Sangareddy', 'Patancheru', 'Zaheerabad', 'Andole', 'Narayankhed'],
    'Mahabubnagar': ['Mahabubnagar Urban', 'Mahabubnagar Rural', 'Jadcherla', 'Bhoothpur'],
    'Nizamabad': ['Nizamabad North', 'Nizamabad South', 'Armoor', 'Bodhan'],
    'Warangal': ['Warangal', 'Narsampet', 'Wardhannapet'],
    'Hanamkonda': ['Hanamkonda', 'Kazipet', 'Parkal'],
    'Khammam': ['Khammam Urban', 'Khammam Rural', 'Kallur', 'Madhira', 'Sathupalli'],
    'Karimnagar': ['Karimnagar', 'Choppadandi', 'Huzurabad', 'Jammikunta'],
    'Nalgonda': ['Nalgonda', 'Miryalaguda', 'Devarakonda'],
    'Suryapet': ['Suryapet', 'Kodad', 'Huzurnagar'],
    'Adilabad': ['Adilabad Urban', 'Adilabad Rural', 'Boath'],
    'Bhadradri Kothagudem': ['Kothagudem', 'Bhadrachalam', 'Yellandu'],
    'Jagtial': ['Jagtial', 'Korutla', 'Metpally'],
    'Jangaon': ['Jangaon', 'Palakurthi'],
    'Jayashankar Bhupalpally': ['Bhupalpally', 'Kataram'],
    'Jogulamba Gadwal': ['Gadwal', 'Alampur'],
    'Kamareddy': ['Kamareddy', 'Banswada'],
    'Kumuram Bheem Asifabad': ['Asifabad', 'Kagaznagar'],
    'Mahabubabad': ['Mahabubabad', 'Dornakal'],
    'Mancherial': ['Mancherial', 'Bellampalli', 'Chennur'],
    'Medak': ['Medak', 'Narsapur'],
    'Mulugu': ['Mulugu', 'Eturnagaram'],
    'Nagarkurnool': ['Nagarkurnool', 'Achampet', 'Kalwakurthy'],
    'Narayanpet': ['Narayanpet', 'Makthal'],
    'Nirmal': ['Nirmal', 'Bhainsa'],
    'Peddapalli': ['Peddapalli', 'Ramagundam'],
    'Rajanna Sircilla': ['Sircilla', 'Vemulawada'],
    'Siddipet': ['Siddipet Urban', 'Gajwel', 'Husnabad'],
    'Vikarabad': ['Vikarabad', 'Tandur', 'Pargi'],
    'Wanaparthy': ['Wanaparthy', 'Kothakota'],
    'Yadadri Bhuvanagiri': ['Bhongir', 'Alair', 'Choutuppal'],
  };

  static const Map<String, List<String>> keralaDistricts = {
    'Alappuzha': ['Ambalapuzha', 'Chengannur', 'Cherthala', 'Karthikappally', 'Kuttanad', 'Mavelikkara'],
    'Ernakulam': ['Aluva', 'Kanayannur (Ernakulam)', 'Kochi', 'Kothamangalam', 'Kunnathunad', 'Muvattupuzha', 'Paravur'],
    'Idukki': ['Devikulam', 'Idukki', 'Peerumade', 'Thodupuzha', 'Udumbanchola'],
    'Kannur': ['Kannur', 'Iritty', 'Payyanur', 'Taliparamba', 'Thalassery'],
    'Kasaragod': ['Hosdurg', 'Kasaragod', 'Manjeshwaram', 'Vellarikundu'],
    'Kollam': ['Kollam', 'Karunagappally', 'Kottarakkara', 'Kunnathur', 'Pathanapuram', 'Punalur'],
    'Kottayam': ['Changanassery', 'Kanjirappally', 'Kottayam', 'Meenachil', 'Vaikom'],
    'Kozhikode': ['Kozhikode', 'Koyilandy', 'Thamarassery', 'Vadakara'],
    'Malappuram': ['Eranad', 'Kondotty', 'Nilambur', 'Perinthalmanna', 'Ponnani', 'Tirur', 'Tirurangadi'],
    'Palakkad': ['Alathur', 'Chittur', 'Mannarkkad', 'Ottappalam', 'Palakkad', 'Pattambi'],
    'Pathanamthitta': ['Adoor', 'Konni', 'Kozhencherry', 'Mallappally', 'Ranni', 'Thiruvalla'],
    'Thiruvananthapuram': ['Chirayinkeezhu', 'Nedumangad', 'Neyyattinkara', 'Thiruvananthapuram', 'Varkala', 'Kattakada'],
    'Thrissur': ['Chalakkudy', 'Chavakkad', 'Kodungallur', 'Mukundapuram', 'Thalapilly', 'Thrissur'],
    'Wayanad': ['Mananthavady', 'Sulthan Bathery', 'Vythiri'],
  };

  static const Map<String, List<String>> maharashtraDistricts = {
    'Ahmednagar': ['Ahmednagar', 'Akole', 'Karjat', 'Kopargaon', 'Newasa', 'Parner', 'Rahuri', 'Sangamner', 'Shrirampur'],
    'Akola': ['Akola', 'Akot', 'Balapur', 'Murtizapur'],
    'Amravati': ['Achalpur', 'Amravati', 'Chandurbazar', 'Morshi', 'Warud'],
    'Chhatrapati Sambhaji Nagar (Aurangabad)': ['Aurangabad', 'Gangapur', 'Kannad', 'Paithan', 'Sillod', 'Vaijapur'],
    'Beed': ['Ambejogai', 'Ashti', 'Beed', 'Georai', 'Majalgaon', 'Parli'],
    'Kolhapur': ['Ajra', 'Gadhinglaj', 'Hatkanangle', 'Kagal', 'Karvir (Kolhapur)', 'Panhala', 'Radhanagari', 'Shirol'],
    'Mumbai City': ['Colaba', 'Fort', 'Dadar', 'Mahim', 'Byculla'],
    'Mumbai Suburban': ['Andheri', 'Bandra', 'Borivali', 'Kurla'],
    'Nagpur': ['Nagpur Urban', 'Nagpur Rural', 'Kamptee', 'Hingna', 'Katol', 'Savner', 'Ramtek', 'Umred'],
    'Nashik': ['Nashik', 'Baglan', 'Chandwad', 'Dindori', 'Igatpuri', 'Malegaon', 'Niphad', 'Sinnar', 'Yeola'],
    'Pune': ['Pune City', 'Haveli', 'Khed', 'Ambegaon', 'Junnar', 'Shirur', 'Daund', 'Baramati', 'Purandar', 'Bhor', 'Maval', 'Mulshi'],
    'Sangli': ['Atpadi', 'Jat', 'Miraj', 'Palus', 'Shirala', 'Tasgaon', 'Walwa'],
    'Satara': ['Satara', 'Karad', 'Wai', 'Mahabaleshwar', 'Phaltan', 'Khandala', 'Khatav', 'Patan'],
    'Solapur': ['Solapur North', 'Solapur South', 'Barshi', 'Karmala', 'Madha', 'Malshiras', 'Mohol', 'Pandharpur', 'Sangola'],
    'Thane': ['Thane', 'Kalyan', 'Murbad', 'Bhiwandi', 'Shahapur', 'Ulhasnagar'],
    'Bhandara': ['Bhandara', 'Tumsar', 'Sakoli'],
    'Buldhana': ['Buldhana', 'Chikhli', 'Khamgaon', 'Malkapur', 'Shegaon'],
    'Chandrapur': ['Chandrapur', 'Ballarpur', 'Warora', 'Bhadravati'],
    'Dhule': ['Dhule', 'Sakri', 'Shirpur', 'Sindkheda'],
    'Gadchiroli': ['Gadchiroli', 'Aheri', 'Armori'],
    'Gondia': ['Gondia', 'Tirora', 'Amgaon'],
    'Hingoli': ['Hingoli', 'Basmath', 'Kalamnuri'],
    'Jalgaon': ['Jalgaon', 'Amalner', 'Bhusawal', 'Chalisgaon', 'Pachora'],
    'Jalna': ['Jalna', 'Ambad', 'Bhokardan', 'Partur'],
    'Latur': ['Latur', 'Ahmadpur', 'Ausa', 'Udgir'],
    'Nanded': ['Nanded', 'Deglur', 'Kinwat', 'Mukhed'],
    'Nandurbar': ['Nandurbar', 'Navapur', 'Shahada'],
    'Dharashiv (Osmanabad)': ['Osmanabad', 'Kalamb', 'Tuljapur', 'Umarga'],
    'Palghar': ['Palghar', 'Dahanu', 'Vasai'],
    'Parbhani': ['Parbhani', 'Gangakhed', 'Jintur'],
    'Raigad': ['Alibag', 'Karjat', 'Mahad', 'Panvel', 'Pen', 'Roha'],
    'Ratnagiri': ['Ratnagiri', 'Chiplun', 'Dapoli', 'Khed'],
    'Sindhudurg': ['Kankavli', 'Kudal', 'Malvan', 'Sawantwadi'],
    'Wardha': ['Wardha', 'Arvi', 'Hinganghat'],
    'Washim': ['Washim', 'Karanja', 'Risod'],
    'Yavatmal': ['Yavatmal', 'Pusad', 'Umarkhed', 'Wani'],
  };

  static Map<String, List<String>> _getDistrictMap(String state) {
    final s = normalizeState(state);
    switch (s) {
      case 'Karnataka':
        return karnatakaDistricts;
      case 'Tamil Nadu':
        return tamilNaduDistricts;
      case 'Andhra Pradesh':
        return andhraPradeshDistricts;
      case 'Telangana':
        return telanganaDistricts;
      case 'Kerala':
        return keralaDistricts;
      case 'Maharashtra':
        return maharashtraDistricts;
      default:
        return const {};
    }
  }

  static List<String> getDistricts(String state) {
    final map = _getDistrictMap(state);
    if (map.isNotEmpty) {
      return map.keys.toList();
    }
    // Fallback default list if state not in top 6
    return const [];
  }

  static List<String> getTaluks(String state, String district) {
    if (district.isEmpty) return const [];
    final map = _getDistrictMap(state);
    if (map.isEmpty) return const [];

    final cleanQuery = district.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    for (final entry in map.entries) {
      final keyClean = entry.key.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
      if (keyClean == cleanQuery || keyClean.contains(cleanQuery) || cleanQuery.contains(keyClean)) {
        return entry.value;
      }
    }
    return const [];
  }

  static String normalizeState(String? state) {
    if (state == null || state.trim().isEmpty) return 'Karnataka';
    final clean = state.trim().toLowerCase();
    if (clean == 'ka' || clean == 'karanataka') return 'Karnataka';
    if (clean.contains('tamil') || clean == 'tn') return 'Tamil Nadu';
    if (clean.contains('andra') || clean.contains('andhra') || clean == 'ap') return 'Andhra Pradesh';
    if (clean.contains('telangana') || clean == 'ts') return 'Telangana';
    if (clean.contains('kerala') || clean == 'kl') return 'Kerala';
    if (clean.contains('maharashtra') || clean.contains('maharastra') || clean == 'mh') return 'Maharashtra';

    final cleanAlnum = clean.replaceAll(RegExp(r'[^a-z0-9]'), '');
    for (final s in states) {
      final sAlnum = s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
      if (sAlnum == cleanAlnum || sAlnum.contains(cleanAlnum)) return s;
    }
    return state.trim();
  }

  static String normalizeDistrict(String state, String? district) {
    if (district == null || district.trim().isEmpty) return '';
    final map = _getDistrictMap(state);
    if (map.isEmpty) return district.trim();

    final cleanQuery = district.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    for (final d in map.keys) {
      final dClean = d.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
      if (dClean == cleanQuery || dClean.contains(cleanQuery) || cleanQuery.contains(dClean)) {
        return d;
      }
    }
    return district.trim();
  }
}
