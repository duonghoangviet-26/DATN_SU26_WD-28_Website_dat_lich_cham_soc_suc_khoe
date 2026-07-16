import { LichHen, LichLamViec, NhatKyThaoTac } from "../models/index.js";

import {
    expirePendingBookingPayment,
    withOptionalTransaction,
} from "./bookingPaymentState.service.js";

// Cron entrypoint. The legacy name is kept because cron imports it directly.
// It now covers both old confirmed/unpaid holds and the current online
// booking flow: pending/unpaid appointments waiting for payment.
export async function autoCancelExpiredHomeAppointments() {
    const expired = await LichHen.find({
        status: { $in: ["pending", "confirmed"] },
        payment_status: "unpaid",
        payment_deadline: { $lt: new Date() },
    });

    let count = 0;
    for (const appointment of expired) {
        const reason = "Qua han thanh toan - he thong tu dong huy";

        await withOptionalTransaction((session) =>
            expirePendingBookingPayment({
                appointmentId: appointment._id,
                actorRole: "system",
                channel: "system_auto_cancel_expired_payment",
                reason,
                session,
            }),
        );

        // Mở lại slot đã giữ chỗ — nếu không, slot bị kẹt vĩnh viễn ở trạng thái đã đặt
        // dù lịch hẹn đã hủy (không ai đặt lại được khung giờ đó nữa).
        if (a.schedule_id && a.slot_id) {
            await LichLamViec.findOneAndUpdate(
                { _id: a.schedule_id, "slots._id": a.slot_id },
                {
                    $set: {
                        "slots.$.status": "active",
                        "slots.$.benh_nhan_id": null,
                    },
                },
            );
        }

        await NhatKyThaoTac.create({
            nguoi_thuc_hien_id: null,
            vai_tro: "system",
            hanh_dong: "AUTO_CANCEL_APPOINTMENT",
            loai_doi_tuong: "appointment",
            doi_tuong_id: appointment._id,
            ly_do: reason,
        });

        count += 1;
    }

    return count;
}
