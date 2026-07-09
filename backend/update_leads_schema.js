const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL');

    // Add decision_engine_state column to leads table
    const alterQuery = `
        ALTER TABLE leads 
        ADD COLUMN decision_engine_state JSON DEFAULT NULL;
    `;

    connection.query(alterQuery, (err, results) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column decision_engine_state already exists.');
            } else {
                console.error('Error adding column:', err);
            }
        } else {
            console.log('Successfully added decision_engine_state column to leads table.');
        }
        
        connection.end();
    });
});
