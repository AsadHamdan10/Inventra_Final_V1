/**
 * ============================================================
 * Inventra — Simplifying Business Operations
 * Backend API — Express.js + TypeScript
 * ============================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';

import { env } from './utils/env';
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import vendorRoutes from './routes/vendors';
import customerRoutes from './routes/customers';
import materialRoutes from './routes/materials';
import purchaseRoutes from './routes/purchases';
import saleRoutes from './routes/sales';
import expenseRoutes from './routes/expenses';
import investorRoutes from './routes/investors';
import intermediaryRoutes from './routes/intermediary';
import gstRoutes from './routes/gst';
import bankRoutes from './routes/bank';
import reportRoutes from './routes/reports';
import dashboardRoutes from './routes/dashboard';
import auditRoutes from './routes/audit';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import eWayBillRoutes from './routes/eWayBillRoutes';
import gstFilingRoutes from './routes/gstFilingRoutes';
import teamRoutes from './routes/team';
// Procurement
import purchaseRequisitions from './routes/purchaseRequisitions';
import purchaseQuotations from './routes/purchaseQuotations';
import purchaseOrdersProcurement from './routes/purchaseOrdersProcurement';
import goodsReceipts from './routes/goodsReceipts';
// Inventory
import inventoryOperations from './routes/inventoryOperations';
import warehouseRoutes from './routes/warehouses';
// Manufacturing
import bom from './routes/bom';
import workCenters from './routes/workCenters';
import routings from './routes/routings';
import productionOrders from './routes/productionOrders';
// Finance
import financialStatements from './routes/financialStatements';
import coaRoutes from './routes/coa';
import journalRoutes from './routes/journals';


const app = express();

// ── Security Headers ──────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
}));

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://inventraerp.vercel.app',
];

app.use(cors({
  origin(origin, callback) {
    // Allow requests without an Origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },

  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── Global Rate Limiter ───────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests from this IP, please try again after 15 minutes." } },
}));

// ── Middleware ────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Inventra API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ── API Routes ────────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/vendors`, vendorRoutes);
app.use(`${API}/customers`, customerRoutes);
app.use(`${API}/materials`, materialRoutes);
app.use(`${API}/purchases`, purchaseRoutes);
app.use(`${API}/sales`, saleRoutes);
app.use(`${API}/expenses`, expenseRoutes);
app.use(`${API}/investors`, investorRoutes);
app.use(`${API}/intermediary`, intermediaryRoutes);
app.use(`${API}/gst`, gstRoutes);
app.use(`${API}/gst/returns`, gstFilingRoutes);
app.use(`${API}/team`, teamRoutes);
app.use(`${API}/bank`, bankRoutes);
app.use(`${API}/reports`, reportRoutes);
app.use(`${API}/dashboard`, dashboardRoutes);
app.use(`${API}/audit`, auditRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/ewaybill`, eWayBillRoutes);
// Procurement
app.use(`${API}/purchase-requisitions`, purchaseRequisitions);
app.use(`${API}/purchase-quotations`, purchaseQuotations);
app.use(`${API}/purchase-orders`, purchaseOrdersProcurement);
app.use(`${API}/goods-receipts`, goodsReceipts);
// Inventory
app.use(`${API}/inventory/warehouses`, warehouseRoutes);
app.use(`${API}/inventory`, inventoryOperations);
// Manufacturing
app.use(`${API}/bom`, bom);
app.use(`${API}/work-centers`, workCenters);
app.use(`${API}/routings`, routings);
app.use(`${API}/production-orders`, productionOrders);
// Finance
app.use(`${API}/finance`, financialStatements);
// Phase 6.10I fix: these two route files existed with full working
// controllers (coaController/journalController) but were never mounted,
// so the Chart of Accounts and Journal Entries pages 404'd on every call.
app.use(`${API}/coa`, coaRoutes);
app.use(`${API}/journals`, journalRoutes);


// ── Error Handlers ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────
const PORT = Number(env.PORT) || 5000;

app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🚀 Inventra API running on port ${PORT}`);
  logger.info(`📍 Environment: ${env.NODE_ENV}`);
});

export default app;
