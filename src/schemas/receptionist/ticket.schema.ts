import { z } from "zod";
import { BookingType } from "@/generated/prisma/enums";

export const bookTherapyTicketSchema = z.object({
  patientId: z.string().min(1, "Please select or register a patient."),
  therapySlotId: z.string().min(1, "Please select an operating therapy slot."),
  appointmentDate: z.string().min(1, "Appointment date is required."),
  bookingType: z
    .enum([BookingType.REGULAR, BookingType.EXTRA])
    .default(BookingType.REGULAR),
  extraReason: z.string().trim().optional(),
  toldTime: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  bookedById: z.string().trim().optional(),
});

export type BookTherapyTicketInput = z.infer<typeof bookTherapyTicketSchema>;

export interface TicketActionState {
  success: boolean;
  message: string;
  appointment?: any;
  fieldErrors?: Record<string, string[]>;
}
