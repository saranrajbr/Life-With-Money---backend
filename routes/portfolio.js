import express from "express";
import Holding from "../models/holding.js";
import auth from "../middleware/authmiddleware.js";

const router = express.Router();

// Lambda/placeholder price provider. Replace with a real quote source when
// integrated, or supply currentPrice per holding from the client.
const PRICES = {}; // symbol -> current price (cached from client updates)

router.get("/", auth, async (req, res) => {
  try {
    const holdings = await Holding.find({ userId: req.user.id }).sort({ symbol: 1 });

    const portfolio = holdings.map((h) => {
      const currentPrice =
        PRICES[h.symbol] != null ? PRICES[h.symbol] : h.avgBuyPrice;
      const marketValue = currentPrice * h.totalQty;
      const invested = h.avgBuyPrice * h.totalQty;
      return {
        id: h._id,
        symbol: h.symbol,
        name: h.name,
        type: h.type,
        lots: h.lots,
        avgBuyPrice: h.avgBuyPrice,
        totalQty: h.totalQty,
        currentPrice,
        marketValue,
        invested,
        gain: marketValue - invested,
        gainPct: invested > 0 ? ((marketValue - invested) / invested) * 100 : 0
      };
    });

    const totals = portfolio.reduce(
      (acc, p) => {
        acc.invested += p.invested;
        acc.marketValue += p.marketValue;
        acc.gain += p.gain;
        return acc;
      },
      { invested: 0, marketValue: 0, gain: 0 }
    );
    totals.gainPct = totals.invested > 0 ? (totals.gain / totals.invested) * 100 : 0;

    res.json({ holdings: portfolio, totals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { symbol, name = "", type = "stock", lots } = req.body;

    if (!symbol || String(symbol).trim().length === 0) {
      return res.status(400).json({ msg: "Symbol is required" });
    }
    if (!Array.isArray(lots) || lots.length === 0) {
      return res.status(400).json({ msg: "At least one lot is required" });
    }
    for (const lot of lots) {
      const qty = Number(lot.qty);
      const price = Number(lot.buyPrice);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ msg: "Each lot needs qty>0 and buyPrice>0" });
      }
    }

    const normLots = lots.map((l) => ({
      qty: Number(l.qty),
      buyPrice: Number(l.buyPrice),
      buyDate: l.buyDate ? new Date(l.buyDate) : new Date()
    }));

    // Upsert holding, appending lots
    let holding = await Holding.findOne({ userId: req.user.id, symbol: symbol.toUpperCase().trim() });
    if (holding) {
      holding.name = name || holding.name;
      holding.lots.push(...normLots);
      await holding.save();
    } else {
      holding = await Holding.create({
        userId: req.user.id,
        symbol: symbol.toUpperCase().trim(),
        name,
        type,
        lots: normLots
      });
    }

    res.status(201).json(holding);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Update current price for a symbol (client-driven, no external API dependency)
router.put("/:id/price", auth, async (req, res) => {
  try {
    const { currentPrice } = req.body;
    const price = Number(currentPrice);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ msg: "Current price must be a non-negative number" });
    }
    const holding = await Holding.findOne({ _id: req.params.id, userId: req.user.id });
    if (!holding) return res.status(404).json({ msg: "Holding not found" });
    PRICES[holding.symbol] = price;
    res.json({ symbol: holding.symbol, currentPrice: price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const holding = await Holding.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    if (!holding) return res.status(404).json({ msg: "Holding not found" });
    if (PRICES[holding.symbol] != null) delete PRICES[holding.symbol];
    res.json({ msg: "Holding removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;