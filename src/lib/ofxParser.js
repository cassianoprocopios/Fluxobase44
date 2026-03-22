/**
 * Parsers para arquivos OFX e CSV bancários.
 * Retorna array de: { id, date, amount, type, description, raw }
 */

export function parseOFX(content) {
  const transactions = [];

  // Tenta extrair blocos STMTTRN
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

  // Fallback para OFX sem tags de fechamento (formato legado SGML)
  if (blocks.length === 0) {
    const stmtSection = content.split(/<BANKTRANLIST>/i)[1]?.split(/<\/BANKTRANLIST>/i)[0] || content;
    const trnBlocks = stmtSection.split(/<STMTTRN>/i).slice(1);

    for (const block of trnBlocks) {
      const get = (tag) => {
        const m = block.match(new RegExp(`<${tag}>([^<\\n\\r]+)`, "i"));
        return m ? m[1].trim() : "";
      };

      const trntype = get("TRNTYPE");
      const dtposted = get("DTPOSTED");
      const trnamt = get("TRNAMT");
      const fitid = get("FITID");
      const memo = get("MEMO") || get("NAME") || "";

      if (!dtposted || !trnamt) continue;

      const amount = parseFloat(trnamt.replace(",", "."));
      const date = parseOFXDate(dtposted);

      transactions.push({
        id: fitid || `ofx-${Date.now()}-${Math.random()}`,
        date,
        amount: Math.abs(amount),
        type: amount >= 0 ? "entrada" : "saida",
        description: memo,
        raw: block,
      });
    }
    return transactions;
  }

  for (const block of blocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([^<]+)`, "i"));
      return m ? m[1].trim() : "";
    };

    const dtposted = get("DTPOSTED");
    const trnamt = get("TRNAMT");
    const fitid = get("FITID");
    const memo = get("MEMO") || get("NAME") || "";

    if (!dtposted || !trnamt) continue;

    const amount = parseFloat(trnamt.replace(",", "."));
    const date = parseOFXDate(dtposted);

    transactions.push({
      id: fitid || `ofx-${Date.now()}-${Math.random()}`,
      date,
      amount: Math.abs(amount),
      type: amount >= 0 ? "entrada" : "saida",
      description: memo,
      raw: block,
    });
  }

  return transactions;
}

function parseOFXDate(raw) {
  // Formatos: 20231015 ou 20231015120000 ou 20231015120000[-3:BRT]
  const clean = raw.replace(/\[.*\]/, "").trim().substring(0, 8);
  const y = clean.substring(0, 4);
  const m = clean.substring(4, 6);
  const d = clean.substring(6, 8);
  return `${y}-${m}-${d}`;
}

export function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Detecta separador
  const sep = lines[0].includes(";") ? ";" : ",";

  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Mapeamento flexível de colunas
  const colMap = {
    date: findCol(headers, ["data", "date", "dt", "data lançamento", "data lancamento"]),
    amount: findCol(headers, ["valor", "amount", "value", "vlr", "montante"]),
    description: findCol(headers, ["descrição", "descricao", "description", "histórico", "historico", "memo", "obs", "lançamento", "lancamento"]),
    type: findCol(headers, ["tipo", "type", "natureza", "dc"]),
  };

  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i], sep);
    if (cells.length < 2) continue;

    const rawDate = cells[colMap.date] ?? "";
    const rawAmount = cells[colMap.amount] ?? "";
    const rawDesc = cells[colMap.description] ?? "";
    const rawType = cells[colMap.type] ?? "";

    const date = parseFlexDate(rawDate.trim().replace(/['"]/g, ""));
    if (!date) continue;

    const cleanAmount = rawAmount.replace(/['"R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(cleanAmount);
    if (isNaN(amount)) continue;

    // Tenta detectar tipo se não houver coluna explícita
    let type;
    if (colMap.type !== -1 && rawType) {
      const t = rawType.toLowerCase().replace(/['"]/g, "");
      type = t.includes("c") || t.includes("crédito") || t.includes("credito") || t === "e" || t === "entrada" ? "entrada" : "saida";
    } else {
      type = amount >= 0 ? "entrada" : "saida";
    }

    transactions.push({
      id: `csv-${i}-${Date.now()}`,
      date,
      amount: Math.abs(amount),
      type,
      description: rawDesc.replace(/['"]/g, "").trim(),
      raw: lines[i],
    });
  }

  return transactions;
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function splitCSVLine(line, sep) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === sep && !inQuotes) { result.push(current); current = ""; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function parseFlexDate(raw) {
  if (!raw) return null;
  // DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return raw;
  // DD-MM-YYYY
  const dmy2 = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2, "0")}-${dmy2[1].padStart(2, "0")}`;
  return null;
}

/**
 * Tenta casar automaticamente transações bancárias com lançamentos do sistema.
 * Retorna array de matches: { bankTx, systemTx | null, score, status }
 * status: "matched" | "pending"
 */
export function autoMatch(bankTransactions, systemTransactions) {
  const usedSystemIds = new Set();

  return bankTransactions.map((btx) => {
    let bestMatch = null;
    let bestScore = 0;

    for (const stx of systemTransactions) {
      if (usedSystemIds.has(stx.id)) continue;

      let score = 0;

      // Valor exato = alta pontuação
      if (Math.abs(btx.amount - stx.amount) < 0.01) score += 50;
      else if (Math.abs(btx.amount - stx.amount) < 1) score += 20;
      else continue; // sem correspondência de valor, ignora

      // Tipo bate
      if (btx.type === stx.type) score += 20;

      // Data próxima (±3 dias)
      const daysDiff = Math.abs(dateDiff(btx.date, stx.date));
      if (daysDiff === 0) score += 30;
      else if (daysDiff <= 1) score += 20;
      else if (daysDiff <= 3) score += 10;
      else if (daysDiff > 7) score -= 20;

      // Similaridade de descrição
      const sim = stringSimilarity(btx.description, stx.description || stx.category || "");
      score += Math.round(sim * 20);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = stx;
      }
    }

    if (bestMatch && bestScore >= 50) {
      usedSystemIds.add(bestMatch.id);
      return { bankTx: btx, systemTx: bestMatch, score: bestScore, status: "matched" };
    }

    return { bankTx: btx, systemTx: null, score: 0, status: "pending" };
  });
}

function dateDiff(a, b) {
  return (new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24);
}

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.7;
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  const common = wordsA.filter((w) => w.length > 3 && wordsB.some((wb) => wb.includes(w) || w.includes(wb)));
  return common.length / Math.max(wordsA.length, wordsB.length);
}