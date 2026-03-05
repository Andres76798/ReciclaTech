const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

/* CREAR CARPETA REPORTES */

const carpetaReportes = path.join(__dirname, "reportes");

if (!fs.existsSync(carpetaReportes)) {
    fs.mkdirSync(carpetaReportes);
}

/* REGISTRAR MATERIAL */

app.post("/material", (req, res) => {

    const { nombre, peso } = req.body;
    const fecha = new Date().toISOString().split("T")[0];

    db.run(
        `INSERT INTO materiales (nombre, peso, fecha_ingreso)
         VALUES (?, ?, ?)`,
        [nombre, peso, fecha],
        function (err) {

            if (err) return res.status(500).json(err);

            res.json({ message: "Material registrado" });
        }
    );
});

/* VER INVENTARIO */

app.get("/inventario", (req, res) => {

    db.all(`SELECT * FROM materiales`, [], (err, rows) => {

        if (err) return res.status(500).json(err);

        res.json(rows);
    });

});

/* ELIMINAR MATERIAL */

app.delete("/material/:id", (req, res) => {

    const id = req.params.id;

    db.run(`DELETE FROM materiales WHERE id=?`, [id], function(err){

        if(err) return res.status(500).json(err);

        res.json({message:"Material eliminado"});
    });

});

/* EDITAR MATERIAL */

app.put("/material/:id", (req, res) => {

    const id = req.params.id;
    const { nombre, peso } = req.body;

    db.run(
        `UPDATE materiales SET nombre=?, peso=? WHERE id=?`,
        [nombre, peso, id],
        function(err){

            if(err) return res.status(500).json(err);

            res.json({message:"Material actualizado"});
        }
    );

});

/* REGISTRAR VENTA */

app.post("/venta", (req, res) => {

    const { material, cantidad, precio, cliente } = req.body;
    const fecha = new Date().toISOString().split("T")[0];

    db.run(
        `INSERT INTO ventas (material, cantidad, precio, cliente, fecha)
         VALUES (?, ?, ?, ?, ?)`,
        [material, cantidad, precio, cliente, fecha],
        function (err) {

            if (err) return res.status(500).json(err);

            db.run(
                `UPDATE materiales
                 SET peso = MAX(peso - ?, 0)
                 WHERE nombre = ?`,
                [cantidad, material]
            );

            res.json({ message: "Venta registrada" });
        }
    );
});

/* VER VENTAS */

app.get("/ventas", (req, res) => {

    db.all(`SELECT * FROM ventas ORDER BY fecha DESC`, [], (err, rows) => {

        if (err) return res.status(500).json(err);

        res.json(rows);
    });

});

/* ELIMINAR VENTA */

app.delete("/venta/:id", (req, res) => {

    const id = req.params.id;

    db.run(`DELETE FROM ventas WHERE id=?`, [id], function(err){

        if(err) return res.status(500).json(err);

        res.json({message:"Venta eliminada"});
    });

});

/* EDITAR VENTA */

app.put("/venta/:id", (req, res) => {

    const id = req.params.id;
    const { material, cantidad, precio, cliente } = req.body;

    db.run(
        `UPDATE ventas
         SET material=?, cantidad=?, precio=?, cliente=?
         WHERE id=?`,
        [material, cantidad, precio, cliente, id],
        function(err){

            if(err) return res.status(500).json(err);

            res.json({message:"Venta actualizada"});
        }
    );

});

/* ESTADISTICAS */

app.get("/estadisticas", (req, res) => {

    db.all(`
        SELECT material as nombre, SUM(cantidad) as total
        FROM ventas
        GROUP BY material
        ORDER BY total DESC
    `, [], (err, rows) => {

        if(err) return res.status(500).json(err);

        res.json(rows);
    });

});

/* GENERAR REPORTE PDF PROFESIONAL */

app.get("/reporte", (req, res) => {

    db.all(`SELECT * FROM ventas ORDER BY fecha DESC`, [], (err, ventas) => {

        const nombreArchivo = `reporte_${Date.now()}.pdf`;
        const filePath = path.join(carpetaReportes, nombreArchivo);

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        /* LOGO */

        const logoPath = path.join(__dirname, "public", "logo.png");

        if(fs.existsSync(logoPath)){
            doc.image(logoPath, 50, 40, { width: 80 });
        }

        /* TITULO */

        doc
        .fontSize(22)
        .fillColor("#2e7d32")
        .text("RECICLATECH", 150, 50);

        doc
        .fontSize(16)
        .fillColor("black")
        .text("Reporte Profesional de Ventas", 150, 80);

        doc.moveDown(2);

        doc.text("Fecha: " + new Date().toLocaleDateString());

        doc.moveDown();

        /* TABLA */

        const tableTop = 180;

        doc.fontSize(12);

        doc.text("Material", 50, tableTop);
        doc.text("Cantidad", 150, tableTop);
        doc.text("Precio", 230, tableTop);
        doc.text("Cliente", 300, tableTop);
        doc.text("Fecha", 450, tableTop);

        doc.moveTo(50, tableTop + 15)
           .lineTo(550, tableTop + 15)
           .stroke();

        let y = tableTop + 30;
        let totalGeneral = 0;

        ventas.forEach(v => {

            const total = v.cantidad * v.precio;
            totalGeneral += total;

            doc.text(v.material, 50, y);
            doc.text(v.cantidad + " kg", 150, y);
            doc.text("$" + v.precio, 230, y);
            doc.text(v.cliente, 300, y);
            doc.text(v.fecha, 450, y);

            y += 25;

        });

        doc.moveDown(2);

        doc
        .fontSize(16)
        .fillColor("#1b5e20")
        .text(`TOTAL GENERAL: $ ${totalGeneral}`, 350, y + 20);

        doc.end();

        stream.on("finish", () => {

            res.download(filePath);

        });

    });

});

app.listen(3000, () => {

    console.log("Servidor iniciado en http://localhost:3000");

});