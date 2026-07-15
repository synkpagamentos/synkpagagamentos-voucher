const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const Voucher = require("./models/Voucher");
const User = require("./models/User");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const sheets = google.sheets("v4");
// const voucherRoutes = require("./routes/voucherRoutes");
// const authRoutes = require("./routes/authRoutes");
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.options("*", cors());
connectDB();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
const SPREADSHEET_ID = "1rE3HM0vmBN6zcZSfp9OhOE6mHWKf0KHnJefNeSXHgWk";

const getGooglePrivateKey = () => {
  let key = process.env.GOOGLE_PRIVATE_KEY || "";
  key = key.trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n");

  // Caso a chave tenha sido colada em uma linha unica (ou os newlines tenham virado espacos)
  if (!key.includes("\n")) {
    const header = "-----BEGIN PRIVATE KEY-----";
    const footer = "-----END PRIVATE KEY-----";
    let body = key;
    if (body.startsWith(header)) {
      body = body.slice(header.length);
    }
    if (body.endsWith(footer)) {
      body = body.slice(0, -footer.length);
    }
    body = body.trim().replace(/\s+/g, ""); // remove todos os espacos e quebras de linha remanescentes
    
    // Reconstrói as linhas de 64 caracteres exigidas pelo formato PEM
    const lines = [];
    for (let i = 0; i < body.length; i += 64) {
      lines.push(body.slice(i, i + 64));
    }
    key = `${header}\n${lines.join("\n")}\n${footer}`;
  }
  
  return key;
};

// app.use("/vouchers", voucherRoutes);
// app.use("/auth", authRoutes);

app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email já está em uso" });
    }

    const newUser = new User({ email, password });
    await newUser.save();

    res.status(201).json({ message: "Usuário registrado com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Rota de login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email ou senha incorretos" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Email ou senha incorretos" });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.post("/vouchers/create", async (req, res) => {
  const generateVoucherInfo = (length = 12) => {
    const charset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let voucher = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      voucher += charset[randomIndex];
    }
    return voucher;
  };

  try {
    const { quantity, value, projectName, expiresAt } = req.body;

    if (!projectName || !expiresAt) {
      return res.status(400).json({ message: "Nome do projeto e data de vencimento são obrigatórios." });
    }

    const authOptions = {
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    };
    if (process.env.GOOGLE_CREDS_BASE64) {
      try {
        const decoded = Buffer.from(process.env.GOOGLE_CREDS_BASE64, 'base64').toString('utf8');
        authOptions.credentials = JSON.parse(decoded);
      } catch (err) {
        console.error("Erro ao decodificar GOOGLE_CREDS_BASE64:", err.message);
      }
    } else if (process.env.GOOGLE_CREDS_JSON) {
      try {
        authOptions.credentials = JSON.parse(process.env.GOOGLE_CREDS_JSON);
      } catch (err) {
        console.error("Erro ao fazer parse de GOOGLE_CREDS_JSON:", err.message);
      }
    } else if (process.env.GOOGLE_KEY_FILE) {
      authOptions.keyFile = process.env.GOOGLE_KEY_FILE;
    } else {
      authOptions.credentials = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: getGooglePrivateKey(),
      };
    }
    const auth = new google.auth.GoogleAuth(authOptions);

    const client = await auth.getClient();
    const spreadsheetId = SPREADSHEET_ID;

    // Verifica se a aba com o nome do projeto já existe
    const sheetMetadata = await sheets.spreadsheets.get({
      auth: client,
      spreadsheetId
    });

    const sheetName = projectName.trim();
    const sheetExists = sheetMetadata.data.sheets.some(
      (s) => s.properties.title === sheetName
    );

    if (!sheetExists) {
      // Cria a nova aba (Sheet) com o nome do projeto
      await sheets.spreadsheets.batchUpdate({
        auth: client,
        spreadsheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      // Adiciona o cabeçalho nativo na nova aba
      await sheets.spreadsheets.values.append({
        auth: client,
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [
            ["CÓDIGO VOUCHER", "SENHA VOUCHER", "VALOR", "RESGATADO", "NOME", "BANCO", "CHAVE PIX", "TIPO DE CHAVE PIX", "VALIDADE", "PROJETO", "ASSINATURA DIGITAL"]
          ],
        },
      });
    } else {
      // A aba já existe: sobrescreve o cabeçalho sempre com a versão correta
      const correctHeader = ["CÓDIGO VOUCHER", "SENHA VOUCHER", "VALOR", "RESGATADO", "NOME", "BANCO", "CHAVE PIX", "TIPO DE CHAVE PIX", "VALIDADE", "PROJETO", "ASSINATURA DIGITAL"];
      await sheets.spreadsheets.values.update({
        auth: client,
        spreadsheetId,
        range: `${sheetName}!A1:K1`,
        valueInputOption: "RAW",
        resource: { values: [correctHeader] },
      });
    }


    const range = `${sheetName}!A1`;

    let createdVouchers = [];

    for (let i = 0; i < quantity; i++) {
      const voucherNumber = generateVoucherInfo();
      const voucherPassword = generateVoucherInfo(8);

      // Garante que o voucher seja válido até o último segundo do dia informado no fuso de Brasília (-03:00)
      const expirationDate = new Date(`${expiresAt}T23:59:59-03:00`);

      const voucher = new Voucher({
        number: voucherNumber,
        password: voucherPassword,
        value: value,
        projectName,
        expiresAt: expirationDate,
      });

      await voucher.save();
      // Inserindo na ordem: CÓDIGO (A), SENHA (B), VALOR (C), RESGATADO (D), NOME (E), BANCO (F), CHAVE PIX (G), TIPO PIX (H), VALIDADE (I), PROJETO (J), ASSINATURA DIGITAL (K)
      // As colunas de resgate (E, F, G, H, K) ficam em branco quando o voucher é criado.
      createdVouchers.push([
        voucherNumber,                                    // A
        voucherPassword,                                  // B
        value,                                            // C
        "NÃO RESGATADO",                                  // D
        "",                                               // E (NOME)
        "",                                               // F (BANCO)
        "",                                               // G (CHAVE PIX)
        "",                                               // H (TIPO PIX)
        expirationDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }), // I (VALIDADE)
        projectName,                                      // J (PROJETO)
        ""                                                // K (ASSINATURA DIGITAL)
      ]);
    }

    const response = await sheets.spreadsheets.values.append({
      auth: client,
      spreadsheetId,
      range: range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: createdVouchers,
      },
    });

    console.log("Google Sheets response:", response);

    res.status(201).json({
      message: `Foram gerados ${quantity} vouchers com sucesso! Confira sua planilha`,
      vouchers: createdVouchers,
    });
  } catch (error) {
    res.status(500).json({ error: error.message, log: error });
  }
});

app.post("/vouchers/redeem", async (req, res) => {
  try {
    const { number, password, nome, cpf, banco, chavePix, tipoChavePix } = req.body;

    const voucher = await Voucher.findOne({ number });
    if (!voucher)
      return res.status(404).json({ message: "Voucher não encontrado" });

    // Verificação base via Banco de Dados:
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      return res.status(400).json({ message: "Voucher vencido. O prazo de resgate terminou" });
    }

    const isMatch = await voucher.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Senha inválida" });

    if (voucher.isRedeemed)
      return res.status(400).json({ message: "Voucher já resgatado" });

    if (!chavePix)
      return res.status(400).json({ message: "Chave Pix é obrigatória" });

    if (!banco) return res.status(400).json({ message: "Banco é obrigatório" });

    if (!tipoChavePix)
      return res
        .status(400)
        .json({ message: "Tipo de Chave Pix é obrigatório" });

    const authOptions = {
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    };
    if (process.env.GOOGLE_CREDS_BASE64) {
      try {
        const decoded = Buffer.from(process.env.GOOGLE_CREDS_BASE64, 'base64').toString('utf8');
        authOptions.credentials = JSON.parse(decoded);
      } catch (err) {
        console.error("Erro ao decodificar GOOGLE_CREDS_BASE64:", err.message);
      }
    } else if (process.env.GOOGLE_CREDS_JSON) {
      try {
        authOptions.credentials = JSON.parse(process.env.GOOGLE_CREDS_JSON);
      } catch (err) {
        console.error("Erro ao fazer parse de GOOGLE_CREDS_JSON:", err.message);
      }
    } else if (process.env.GOOGLE_KEY_FILE) {
      authOptions.keyFile = process.env.GOOGLE_KEY_FILE;
    } else {
      authOptions.credentials = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: getGooglePrivateKey(),
      };
    }
    const auth = new google.auth.GoogleAuth(authOptions);

    const client = await auth.getClient();
    const spreadsheetId = SPREADSHEET_ID;

    // Obtém metadados de todas as abas para poder buscar em todas se necessário
    const sheetMetadata = await sheets.spreadsheets.get({ auth: client, spreadsheetId });
    const allSheets = sheetMetadata.data.sheets;

    // Define a aba preferencial baseada no projeto do voucher (ou Sheet1)
    let preferredSheetName = voucher.projectName ? voucher.projectName.trim() : "Sheet1";
    
    let sheetName = null;
    let rows = [];
    let voucherRowIndex = -1;

    // Função auxiliar para ler dados de uma aba
    const fetchSheetData = async (name) => {
      try {
        const res = await sheets.spreadsheets.values.get({
          auth: client,
          spreadsheetId,
          range: `${name}!A1:Z`,
        });
        return res.data.values || [];
      } catch (error) {
        console.error(`Erro ao ler aba ${name}:`, error.message);
        return [];
      }
    };

    // 1. Tenta buscar na aba preferencial primeiro
    const preferredSheetExists = allSheets.some(s => s.properties.title === preferredSheetName);
    if (preferredSheetExists) {
      const data = await fetchSheetData(preferredSheetName);
      const idx = data.findIndex((row) => row[0] === number);
      if (idx !== -1) {
        sheetName = preferredSheetName;
        rows = data;
        voucherRowIndex = idx;
      }
    }

    // 2. Se não encontrou na preferencial, busca em TODAS as outras abas
    if (voucherRowIndex === -1) {
      console.log(`Voucher ${number} não encontrado na aba preferencial (${preferredSheetName}). Buscando em todas as abas...`);
      for (const sheet of allSheets) {
        const currentSheetName = sheet.properties.title;
        if (currentSheetName === preferredSheetName) continue; // Já verificado

        const data = await fetchSheetData(currentSheetName);
        const idx = data.findIndex((row) => row[0] === number);
        if (idx !== -1) {
          sheetName = currentSheetName;
          rows = data;
          voucherRowIndex = idx;
          console.log(`Voucher encontrado na aba: ${sheetName}`);
          break; // Encontrou
        }
      }
    }

    if (voucherRowIndex === -1 || !sheetName) {
      return res
        .status(404)
        .json({ message: "Voucher não encontrado em nenhuma aba da planilha" });
    }

    const currentRowData = rows[voucherRowIndex];
    console.log("=== Lendo dados do Voucher no Google Sheets ===");
    console.log("Dados integrais da linha:", currentRowData);

    // Validação extra: Conferir a Data Diretamente da Planilha (Coluna I = index 8)
    const validadeNaPlanilha = currentRowData[8];
    if (validadeNaPlanilha) {
      // Formato esperado DD/MM/YYYY
      const partes = validadeNaPlanilha.split("/");
      if (partes.length === 3) {
        // Converte DD/MM/YYYY para o instante final do dia em Brasília (XX:59:59)
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        const ano = partes[2];
        const dataLimitePlanilha = new Date(`${ano}-${mes}-${dia}T23:59:59-03:00`);

        console.log(`Verificando Validade Sheets: Limite=${dataLimitePlanilha} | Agora=${new Date()}`);
        if (new Date() > dataLimitePlanilha) {
          return res.status(400).json({ message: "Voucher vencido. O prazo de resgate terminou" });
        }
      }
    }

    const timestampBrasil = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const validade = currentRowData[8] || "";
    const projeto = currentRowData[9] || "";

    // Concatena os novos valores de acordo com a ordem das colunas
    // Colunas vão atualizar a partir da Coluna D até a K
    const updatedRowData = [
      "RESGATADO",              // Coluna D: RESGATADO
      nome || cpf || "-",       // Coluna E: NOME
      banco,                    // Coluna F: BANCO
      chavePix,                 // Coluna G: CHAVE PIX
      tipoChavePix,             // Coluna H: TIPO DE CHAVE PIX
      validade,                 // Coluna I: VALIDADE (mantém)
      projeto,                  // Coluna J: PROJETO (mantém)
      timestampBrasil           // Coluna K: DATA/HORA RESGATE
    ];

    // Atualiza das colunas D até K (na linha do voucher correspondente)
    const updateRange = `${sheetName}!D${voucherRowIndex + 1}:K${voucherRowIndex + 1}`;

    await sheets.spreadsheets.values.update({
      auth: client,
      spreadsheetId,
      range: updateRange,
      valueInputOption: "RAW",
      resource: {
        values: [updatedRowData],
      },
    });

    voucher.isRedeemed = true;
    voucher.redeemedAtString = timestampBrasil;
    await voucher.save();

    res.status(200).json({
      message:
        "Suas informações foram salvas com sucesso! Em breve, o valor do voucher será creditado na conta informada.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message, log: error });
  }
});

app.get("/getAll", async (req, res) => {
  try {
    const vouchers = await Voucher.find();

    if (!vouchers || vouchers.length === 0) {
      return res.status(404).json({ message: "Nenhum voucher encontrado" });
    }

    res.status(200).json(vouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// app.use("/", (req, res) => {
//   res.send("API MOBCASH IS RUNNING");
// })

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
