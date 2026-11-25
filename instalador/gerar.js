// Gera downloads/INSTALAR-PONTE-EDUCAWEB.cmd = modelo.cmd + ponte.js. Rode sempre que mudar a ponte: node instalador/gerar.js
const fs = require("fs"), path = require("path"), r = p => fs.readFileSync(path.join(__dirname, p), "utf8").replace(/\r/g, "");
fs.writeFileSync(path.join(__dirname, "..", "downloads", "INSTALAR-PONTE-EDUCAWEB.cmd"), (r("modelo.cmd") + r("../ponte.js")).replace(/\n/g, "\r\n"));
