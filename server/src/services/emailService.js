// src/services/emailService.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER || "intracorreo7@gmail.com",
        pass: process.env.EMAIL_PASSWORD || "fgyx zfpl qlkc nsmt",
    },
    tls: {
        rejectUnauthorized: false
    },
});

export const sendEmail = async ({ to, subject, html }) => {
    try {
        await transporter.sendMail({
            from: `"Intranet Corporativa" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`Email enviado a ${to}`);
    } catch (error) {
        console.error("Error enviando email:", error);
        throw error;
    }
};