import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer";

export async function createInvite(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/trips/:tripId/invites",
        {
            schema: {
                params: z.object({
                    tripId: z.string().uuid(),
                }),
                body: z.object({
                    email: z.string().email(),
                }),
            },
        },
        async (request) => {
            const { tripId } = request.params;
            const { email } = request.body;

            const trip = await prisma.trip.findUnique({
                where: {
                    id: tripId,
                },
            });

            if (!trip) {
                throw new Error("Trip not found");
            }

            const participant = await prisma.participant.create({
                data: {
                    email,
                    trip_id: tripId,
                },
            });

            const formattedStartDate = dayjs(trip.starts_at).format("LL");
            const formattedEndDate = dayjs(trip.ends_at).format("LL");

            const mail = await getMailClient();

            const confirmationLink = `http://localhost:3333/participants/${participant.id}/confirm`;

            const message = await mail.sendMail({
                from: {
                    name: "Equipe plann.er",
                    address: "My address",
                },
                to: participant.email,
                subject: "Confirme sua presença",
                html: `
                            <p>Voce foi convidado para uma viagem no ${trip.destination} em ${formattedStartDate}</p>
                            <p> <a href="${confirmationLink}" ></a> </p>
                        `.trim(),
            });

            console.log(nodemailer.getTestMessageUrl(message));

            return { participantId: participant.id };
        }
    );
}
