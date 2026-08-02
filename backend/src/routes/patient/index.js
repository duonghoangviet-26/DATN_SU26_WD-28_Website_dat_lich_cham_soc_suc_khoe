import { Router } from "express";
import { verifyToken, requireRole } from "../../middlewares/auth.middleware.js";
import familyRoutes from "./family.routes.js";
import recordsRoutes from "./records.routes.js";
import prescriptionsRoutes from "./prescriptions.routes.js";
import bookingRoutes from "./booking.routes.js";
import notificationRoutes from "./notifications.routes.js";
import paymentsRoutes from "./payments.routes.js";
import rescheduleRoutes from "./reschedule.routes.js";
import reviewRoutes from "./review.routes.js";

// ============================================================
// Patient routes — mount tại /api/patient
// Toàn bộ route đều yêu cầu role='user'
// ============================================================

const router = Router();

// Public read-only booking endpoints are mounted before auth so guests can
// browse doctors/services/slots. Mutating booking routes protect themselves.
router.use("/booking", bookingRoutes);

// Payment routes tự quản lý auth bên trong (cần mở cho VNPay gọi vào)
router.use("/payments", paymentsRoutes);

router.use(verifyToken, requireRole("user", "patient"));

router.use("/family", familyRoutes);
router.use("/records", recordsRoutes);
router.use("/prescriptions", prescriptionsRoutes);
router.use("/notifications", notificationRoutes);
router.use("/payments", paymentsRoutes);
router.use("/appointments", rescheduleRoutes);
router.use("/reviews", reviewRoutes);

export default router;
