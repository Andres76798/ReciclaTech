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

const carpetaReportes = path.join(__dirname, "reportes");
if (!fs.existsSync(carpetaReportes)) fs.mkdirSync(carpetaReportes);

// --- MATERIALES (INVENTARIO) ---

app.post("/material", (req, res) => {
    const { nombre, peso } = req.body;
    const fecha = new Date().toISOString().split("T")[0];
    db.run(`INSERT INTO materiales (nombre, peso, fecha_ingreso) VALUES (?, ?, ?)`, [nombre, peso, fecha], (err) => {
        if (err) return res.status(500).json({status: "error", message: err.message});
        res.json({ status: "success", message: "Material registrado correctamente" });
    });
});

app.get("/inventario", (req, res) => {
    db.all(`SELECT * FROM materiales`, [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.put("/material/:id", (req, res) => {
    const { nombre, peso } = req.body;
    db.run(`UPDATE materiales SET nombre=?, peso=? WHERE id=?`, [nombre, peso, req.params.id], function(err) {
        if (err) return res.status(500).json({status: "error"});
        res.json({status: "success", message: "Inventario actualizado"});
    });
});

app.delete("/material/:id", (req, res) => {
    db.run(`DELETE FROM materiales WHERE id=?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({status: "error"});
        res.json({status: "success", message: "Material eliminado"});
    });
});

// NUEVA RUTA: Obtener el total de kg en el inventario actual (Para el Dashboard)
app.get("/total-stock", (req, res) => {
    db.get(`SELECT SUM(peso) as totalKg FROM materiales`, [], (err, row) => {
        if (err) return res.status(500).json(err);
        res.json({ totalKg: row.totalKg || 0 });
    });
});

// --- VENTAS ---

// Registrar Venta
app.post("/venta", (req, res) => {
    const { material_id, material_nombre, cantidad, precio, cliente } = req.body;
    const fecha = new Date().toISOString().split("T")[0];
    db.serialize(() => {
        db.run(`INSERT INTO ventas (material, cantidad, precio, cliente, fecha) VALUES (?, ?, ?, ?, ?)`,
            [material_nombre, cantidad, precio, cliente, fecha]);
        db.run(`UPDATE materiales SET peso = MAX(peso - ?, 0) WHERE id = ?`, [cantidad, material_id], (err) => {
            if (err) return res.status(500).json({status: "error"});
            res.json({ status: "success", message: "Venta procesada con éxito" });
        });
    });
});

// Obtener todas las ventas
app.get("/ventas", (req, res) => {
    db.all(`SELECT * FROM ventas ORDER BY fecha DESC`, [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

// EDITAR VENTA (Nueva funcionalidad)
app.put("/venta/:id", (req, res) => {
    const { material, cantidad, precio, cliente } = req.body;
    db.run(
        `UPDATE ventas SET material=?, cantidad=?, precio=?, cliente=? WHERE id=?`,
        [material, cantidad, precio, cliente, req.params.id],
        function(err) {
            if (err) return res.status(500).json({status: "error"});
            res.json({ status: "success", message: "Venta actualizada" });
        }
    );
});

// ELIMINAR VENTA (Nueva funcionalidad)
app.delete("/venta/:id", (req, res) => {
    db.run(`DELETE FROM ventas WHERE id=?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({status: "error"});
        res.json({ status: "success", message: "Venta eliminada" });
    });
});

// --- ESTADISTICAS Y GANANCIAS ---

app.get("/resumen-financiero", (req, res) => {
    db.get(`SELECT SUM(cantidad * precio) as totalGanancias FROM ventas`, [], (err, row) => {
        if (err) return res.status(500).json(err);
        res.json({ totalGanancias: row.totalGanancias || 0 });
    });
});

app.get("/estadisticas", (req, res) => {
    db.all(`SELECT material as nombre, SUM(cantidad) as total FROM ventas GROUP BY material`, [], (err, rows) => {
        if(err) return res.status(500).json(err);
        res.json(rows);
    });
});

// --- REPORTE PDF MEJORADO Y PROFESIONAL ---

app.get("/reporte", (req, res) => {
    db.all(`SELECT * FROM ventas ORDER BY fecha DESC`, [], (err, ventas) => {
        if (err) return res.status(500).json(err);

        const doc = new PDFDocument({ margin: 50 });
        const nombreArchivo = `Reporte_ReciclaTech_${Date.now()}.pdf`;
        const filePath = path.join(carpetaReportes, nombreArchivo);
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        const logoPath = path.join(__dirname, "public", "images", "logo.png");
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 45, { width: 50 });
        }

        doc.fillColor("#2e7d32").fontSize(22).text("RECICLATECH", 110, 50);
        doc.fontSize(10).fillColor("#555555").text("Gestión Inteligente de Residuos", 110, 75);
        doc.moveDown(2);

        doc.fillColor("#000000").fontSize(16).text("REPORTE DE VENTAS", { align: "center" });
        doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString()}`, { align: "center" });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#2e7d32");
        doc.moveDown();

        const tableTop = doc.y;
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#2e7d32");
        doc.text("Fecha", 50, tableTop);
        doc.text("Material", 150, tableTop);
        doc.text("Peso", 280, tableTop);
        doc.text("Precio U.", 370, tableTop);
        doc.text("Subtotal", 470, tableTop);

        doc.moveDown(0.5);
        let y = doc.y + 10;
        let totalGeneral = 0;

        doc.font("Helvetica").fillColor("#333333").fontSize(10);
        ventas.forEach(v => {
            const subtotal = v.cantidad * v.precio;
            totalGeneral += subtotal;

            if (y > 700) { doc.addPage(); y = 50; }

            doc.text(v.fecha, 50, y);
            doc.text(v.material, 150, y);
            doc.text(`${v.cantidad} kg`, 280, y);
            doc.text(`$${v.precio}`, 370, y);
            doc.text(`$${subtotal.toLocaleString()}`, 470, y);

            y += 20;
            doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke("#eeeeee");
        });

        y += 15;
        doc.rect(350, y, 200, 30).fill("#e8f5e9");
        doc.fillColor("#1b5e20").font("Helvetica-Bold").fontSize(12)
            .text(`TOTAL: $${totalGeneral.toLocaleString()}`, 370, y + 10);

        doc.end();

        stream.on("finish", () => {
            res.download(filePath);
        });
    });
});

app.listen(3000, () => console.log("Servidor ReciclaTech Pro en puerto 3000"));