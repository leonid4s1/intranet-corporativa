// server/src/models/VacationData.js
import mongoose from "mongoose";

const vacationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    total: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('VacationData', vacationSchema);