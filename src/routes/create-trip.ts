import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import localizedFormat from "dayjs/plugin/localizedFormat";
import nodemailer from "nodemailer";
import { getMailClient } from "../lib/mail";

dayjs.locale("pt-br");
dayjs.extend(localizedFormat);

export async function createTrip(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/trips",
        {
            schema: {
                body: z.object({
                    destination: z.string().min(4),
                    starts_at: z.coerce.date(),
                    ends_at: z.coerce.date(),
                    owner_name: z.string(),
                    owner_email: z.string().email(),
                    emails_to_invite: z.array(z.string().email()),
                }),
            },
        },
        async (request) => {
            const {
                destination,
                ends_at,
                starts_at,
                owner_name,
                owner_email,
                emails_to_invite,
            } = request.body;

            if (dayjs(starts_at).isBefore(new Date())) {
                throw new Error("Invalid trip start date.");
            }

            if (dayjs(ends_at).isBefore(starts_at)) {
                throw new Error("Invalid trip end date.");
            }

            const trip = await prisma.trip.create({
                data: {
                    destination,
                    starts_at,
                    ends_at,
                    participants: {
                        createMany: {
                            data: [
                                {
                                    name: owner_name,
                                    email: owner_email,
                                    is_owner: true,
                                    is_confirmed: true,
                                },
                                ...emails_to_invite.map((email) => {
                                    return { email };
                                }),
                            ],
                        },
                    },
                },
            });

            const formattedStartDate = dayjs(starts_at).format("LL");
            const formattedEndDate = dayjs(ends_at).format("LL");

            const confirmationLink = `http://localhost:3333/trips/${trip.id}/confirm`;

            const mail = await getMailClient();

            const message = await mail.sendMail({
                from: {
                    name: "Equipe plann.er",
                    address: "My address",
                },
                to: {
                    name: owner_name,
                    address: owner_email,
                },
                subject: "Testando envio de email",
                html: `
                    <p>Voce solicitoua a criação de viagem para ${destination} em ${formattedStartDate}</p>
                    <p> <a href="${confirmationLink}" ></a> </p>
                `.trim(),
            });

            console.log(nodemailer.getTestMessageUrl(message));

            return { tripId: trip.id };
        }
    );
}
