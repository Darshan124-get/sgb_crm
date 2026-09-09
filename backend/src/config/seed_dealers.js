const pool = require('./db');

async function seedDealers() {
    const seedData = [
        {
            dealer_name: 'Sree Lakshmi Agri Store',
            contact_person: 'Ramesh Gowda',
            phone: '98765 43210',
            address: 'Tumkur Taluk, Tumkur, Karnataka - 572101',
            town_village: 'Tumkur',
            city: 'Tumkur',
            taluk: 'Tumkur',
            district: 'Tumkur',
            state: 'Karnataka',
            pincode: '572101',
            visited_date: '26/08/2025',
            visited_by: 'Suresh Kumar',
            gst_no: '29ABCDE1234F1Z5',
            status: 'Active'
        },
        {
            dealer_name: 'Greenfield Agro Traders',
            contact_person: 'Mahesh Hegde',
            phone: '93423 45587',
            address: 'Nanjangud Taluk, Mysuru, Karnataka - 571301',
            town_village: 'Nanjangud',
            city: 'Mysuru',
            taluk: 'Nanjangud',
            district: 'Mysuru',
            state: 'Karnataka',
            pincode: '571301',
            visited_date: '25/08/2025',
            visited_by: 'Shiva Prasad',
            gst_no: '27AAHFG5678K1Z2',
            status: 'Active'
        },
        {
            dealer_name: 'Sri Venkatesh Seeds',
            contact_person: 'Venkatesh M',
            phone: '99801 23456',
            address: 'Hubli Taluk, Dharwad, Karnataka - 580020',
            town_village: 'Hubli',
            city: 'Dharwad',
            taluk: 'Hubli',
            district: 'Dharwad',
            state: 'Karnataka',
            pincode: '580020',
            visited_date: '24/08/2025',
            visited_by: 'Kiran P',
            gst_no: '29BCKPT6789A1Z3',
            status: 'New'
        },
        {
            dealer_name: 'Om Agro Centre',
            contact_person: 'Nagaraj S',
            phone: '98450 67890',
            address: 'Hassan Taluk, Hassan, Karnataka - 573201',
            town_village: 'Hassan',
            city: 'Hassan',
            taluk: 'Hassan',
            district: 'Hassan',
            state: 'Karnataka',
            pincode: '573201',
            visited_date: '22/08/2025',
            visited_by: 'Raghavendra',
            gst_no: '29CDXPS4567B1Z1',
            status: 'Inactive'
        },
        {
            dealer_name: 'Krishna Fertilizers',
            contact_person: 'Prakash B',
            phone: '90085 11223',
            address: 'Belagavi Taluk, Belagavi, Karnataka - 590001',
            town_village: 'Belagavi',
            city: 'Belagavi',
            taluk: 'Belagavi',
            district: 'Belagavi',
            state: 'Karnataka',
            pincode: '590001',
            visited_date: '21/08/2025',
            visited_by: 'Vinay H',
            gst_no: '27AAKFK3456A1Z9',
            status: 'Active'
        }
    ];

    try {
        const [existing] = await pool.query("SELECT COUNT(*) as count FROM dealers");
        if (existing[0].count === 0) {
            for (const d of seedData) {
                await pool.query(
                    `INSERT INTO dealers (dealer_name, contact_person, phone, address, town_village, city, taluk, district, state, pincode, visited_date, visited_by, gst_no, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [d.dealer_name, d.contact_person, d.phone, d.address, d.town_village, d.city, d.taluk, d.district, d.state, d.pincode, d.visited_date, d.visited_by, d.gst_no, d.status]
                );
            }
            console.log("Seeded dealers demo data successfully.");
        } else {
            console.log(`Dealers table already has ${existing[0].count} entries.`);
        }
    } catch (e) {
        console.error("Seeding error:", e);
    }
    process.exit(0);
}

seedDealers();
