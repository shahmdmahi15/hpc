"use client";

import * as React from "react";
import {
  StaffPerformerSelect,
  type StaffPerformer,
  type StaffPerformerSelectProps,
} from "@/components/shared/staff-performer-select";

export type ReceptionistPerformer = StaffPerformer;

export interface ReceptionistPerformerSelectProps extends StaffPerformerSelectProps {}

export function ReceptionistPerformerSelect(props: ReceptionistPerformerSelectProps) {
  return (
    <StaffPerformerSelect
      label="Authorizing Receptionist"
      pinLabel="Staff 4-Digit PIN:"
      fallbackRoleName="Reception Desk"
      pinInputName="receptionist_performer_auth_pin"
      {...props}
    />
  );
}
