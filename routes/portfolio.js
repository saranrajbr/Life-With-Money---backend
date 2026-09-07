import express from "express";
import mongoose from "mongoose";
import Holding from "../models/holding.js";
import auth from "../middleware/authmiddleware.js";

const router = express.Router();

const TYPES = ["stock", "mutual_fund", "crypto", "other"];

function publicHolding(h) {
  const currentPrice = h.currentPrice ?? h.avgBuyPrice;
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
}

router.get("/", auth, async (req, res) => {
  try {
    const holdings = await Holding.find({ userId: req.user.id }).sort({ symbol: 1 });
    const portfolio = holdings.map(publicHolding);

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

    // Per-type breakdown for a richer summary
    const byType = {};
    for (const p of portfolio) {
      if (!byType[p.type]) byType[p.type] = { invested: 0, marketValue: 0, gain: 0 };
      byType[p.type].invested += p.invested;
      byType[p.type].marketValue += p.marketValue;
      byType[p.type].gain += p.gain;
    }

    res.json({ holdings: portfolio, totals, byType });
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
    if (!TYPES.includes(type)) {
      return res.status(400).json({ msg: "Invalid holding type" });
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
      const currentPrice =
        req.body.currentPrice != null && Number(req.body.currentPrice) >= 0
          ? Number(req.body.currentPrice)
          : null;
      holding = await Holding.create({
        userId: req.user.id,
        symbol: symbol.toUpperCase().trim(),
        name,
        type,
        lots: normLots,
        currentPrice
      });
    }

    res.status(201).json(publicHolding(holding));
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Update current price (persisted so it survives restarts)
router.put("/:id/price", auth, async (req, res) => {
  try {
    const price = Number(req.body.currentPrice);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ msg: "Current price must be a non-negative number" });
    }
    const holding = await Holding.findOne({ _id: req.params.id, userId: req.user.id });
    if (!holding) return res.status(404).json({ msg: "Holding not found" });
    holding.currentPrice = price;
    await holding.save();
    res.json({ symbol: holding.symbol, currentPrice: price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Edit holding metadata (name, type, or run a manual price update)
router.put("/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid holding id" });
    }
    const holding = await Holding.findOne({ _id: id, userId: req.user.id });
    if (!holding) return res.status(404).json({ msg: "Holding not found" });

    if (req.body.name !== undefined) holding.name = String(req.body.name).slice(0, 120);
    if (req.body.type !== undefined) {
      if (!TYPES.includes(req.body.type)) {
        return res.status(400).json({ msg: "Invalid holding type" });
      }
      holding.type = req.body.type;
    }
    if (req.body.currentPrice !== undefined) {
      const price = Number(req.body.currentPrice);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ msg: "Current price must be a non-negative number" });
      }
      holding.currentPrice = price;
    }

    await holding.save();
    res.json(publicHolding(holding));
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Edit a single lot
router.put("/:id/lots/:lotId", auth, async (req, res) => {
  try {
    const holding = await Holding.findOne({ _id: req.params.id, userId: req.user.id });
    if (!holding) return res.status(404).json({ msg: "Holding not found" });

    const lot = holding.lots.id(req.params.lotId);
    if (!lot) return res.status(404).json({ msg: "Lot not found" });

    if (req.body.qty !== undefined) {
      const qty = Number(req.body.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ msg: "Quantity must be greater than 0" });
      }
      lot.qty = qty;
    }
    if (req.body.buyPrice !== undefined) {
      const price = Number(req.body.buyPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ msg: "Buy price must be greater than 0" });
      }
      lot.buyPrice = price;
    }
    if (req.body.buyDate !== undefined) lot.buyDate = new Date(req.body.buyDate);

    await holding.save();
    res.json(publicHolding(holding));
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Remove (sell) an entire lot
router.delete("/:id/lots/:lotId", auth, async (req, res) => {
  try {
    const holding = await Holding.findOne({ _id: req.params.id, userId: req.user.id });
    if (!holding) return res.status(404).json({ msg: "Holding not found" });

    const removed = holding.lots.id(req.params.lotId);
    if (!removed) return res.status(404).json({ msg: "Lot not found" });

    holding.lots.pull({ _id: req.params.lotId });
    await holding.save();
    res.json({ msg: "Lot removed", holding: publicHolding(holding) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Sell a partial quantity (FIFO across lots). Optionally records the sale price.
router.post("/:id/sell", auth, async (req, res) => {
  try {
    const sellQty = Number(req.body.qty);
    if (!Number.isFinite(sellQty) || sellQty <= 0) {
      return res.status(400).json({ msg: "Sell quantity must be greater than 0" });
    }

    const holding = await Holding.findOne({ _id: req.params.id, userId: req.user.id });
    if (!holding) return res.status(404).json({ msg: "Holding not found" });
    if (sellQty > holding.totalQty) {
      return res.status(400).json({ msg: "Cannot sell more than current quantity" });
    }

    const soldPrice =
      req.body.sellPrice != null ? Number(req.body.sellPrice) : holding.currentPrice ?? holding.avgBuyPrice;

    let remaining = sellQty;
    // FIFO: consume oldest lots first
    const ordered = [...holding.lots].sort((a, b) => new Date(a.buyDate) - new Date(b.buyDate));
    for (const lot of ordered) {
      if (remaining <= 0) break;
      if (lot.qty <= remaining) {
        remaining -= lot.qty;
        holding.lots.pull({ _id: lot._id });
      } else {
        lot.qty -= remaining;
        remaining = 0;
      }
    }

    await holding.save();
    res.json({ msg: "Sold", realizedGainPct: null, holding: publicHolding(holding), soldPrice });
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
    res.json({ msg: "Holding removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;