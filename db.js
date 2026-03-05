const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error("Error conectando a SQLite", err);
    } else {
        console.log("Base de datos conectada");
    }
});

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS materiales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            tipo TEXT,
            subtipo TEXT,
            peso REAL,
            proveedor TEXT,
            fecha_ingreso TEXT,
            ubicacion TEXT
        )
    `, (err) => {
        if (err) console.log("Tabla materiales ya existe o error:", err.message);
        else console.log("Tabla materiales creada/verificada");
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material TEXT,
            cantidad REAL,
            precio REAL,
            cliente TEXT,
            fecha TEXT
        )
    `, (err) => {
        if (err) console.log("Tabla ventas ya existe o error:", err.message);
        else console.log("Tabla ventas creada/verificada");
    });

});

module.exports = db;