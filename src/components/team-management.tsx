"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvitation,
} from "@/lib/actions/team";
import { ORGANIZATION_ROLE_LABELS } from "@/lib/constants";
import { ORGANIZATION_ROLES, type OrganizationRole } from "@/lib/types";
import {
  INVITATION_STATUS_LABELS,
  INVITATION_STATUS_TONE,
  type Invitation,
  type Member,
} from "@/lib/team/types";
import {
  Alert,
  Badge,
  Blank,
  Button,
  EmptyState,
  Input,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Thead,
  ToolbarField,
  Tr,
} from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";
import { formatDate } from "@/lib/utils";

const INITIAL: ActionState = { ok: true };

function Submit({ idle, busy, variant = "secondary", size = "sm" }: {
  idle: string;
  busy: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "xs" | "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Mitglieder                                                                 */
/* -------------------------------------------------------------------------- */

export function MemberTable({
  members,
  canManage,
  ownRole,
}: {
  members: Member[];
  canManage: boolean;
  ownRole: OrganizationRole;
}) {
  return (
    <TableWrap>
      <Table>
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th className="hidden sm:table-cell">E-Mail</Th>
            <Th>Rolle</Th>
            <Th align="right" className="hidden md:table-cell">
              Seit
            </Th>
            {canManage ? <Th align="right">Aktion</Th> : null}
          </tr>
        </Thead>
        <tbody>
          {members.map((member) => (
            <Tr key={member.id}>
              <Td>
                <span className="font-medium text-slate-900">
                  {member.fullName ?? member.email ?? "Unbekannt"}
                </span>
                {member.isSelf ? (
                  <span className="ml-1.5 text-[11px] text-slate-400">(du)</span>
                ) : null}
              </Td>
              <Td className="hidden text-slate-600 sm:table-cell">{member.email ?? <Blank />}</Td>
              <Td>
                {canManage && !member.isSelf ? (
                  <RoleSelect member={member} ownRole={ownRole} />
                ) : (
                  <Badge>{ORGANIZATION_ROLE_LABELS[member.role]}</Badge>
                )}
              </Td>
              <Td align="right" className="hidden whitespace-nowrap text-slate-500 md:table-cell">
                {formatDate(member.joinedAt)}
              </Td>
              {canManage ? (
                <Td align="right">
                  {member.isSelf ? <Blank /> : <RemoveMemberButton memberId={member.id} />}
                </Td>
              ) : null}
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function RoleSelect({ member, ownRole }: { member: Member; ownRole: OrganizationRole }) {
  const [state, action] = useActionState(changeMemberRole, INITIAL);
  const { pending } = useFormStatus();

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="memberId" value={member.id} />
      <Select
        name="role"
        defaultValue={member.role}
        aria-label={`Rolle von ${member.fullName ?? member.email}`}
        className="h-7 w-36 text-[12px]"
        disabled={pending}
      >
        {ORGANIZATION_ROLES.filter((role) => role !== "OWNER" || ownRole === "OWNER").map((role) => (
          <option key={role} value={role}>
            {ORGANIZATION_ROLE_LABELS[role]}
          </option>
        ))}
      </Select>
      <Submit idle="Setzen" busy="…" size="xs" variant="ghost" />
      {!state.ok && state.message ? (
        <span className="text-[11px] text-rose-700">{state.message}</span>
      ) : null}
    </form>
  );
}

function RemoveMemberButton({ memberId }: { memberId: string }) {
  const [state, action] = useActionState(removeMember, INITIAL);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <>
        <Button type="button" size="xs" variant="ghost" onClick={() => setConfirming(true)}>
          Entfernen
        </Button>
        {!state.ok && state.message ? (
          <p className="mt-0.5 text-[11px] text-rose-700">{state.message}</p>
        ) : null}
      </>
    );
  }

  return (
    <form action={action} className="flex items-center justify-end gap-1">
      <input type="hidden" name="memberId" value={memberId} />
      <span className="text-[11px] text-slate-500">Sicher?</span>
      <Submit idle="Ja, entfernen" busy="…" size="xs" variant="danger" />
      <Button type="button" size="xs" variant="ghost" onClick={() => setConfirming(false)}>
        Abbrechen
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Einladungen                                                                */
/* -------------------------------------------------------------------------- */

export function InviteForm() {
  const [state, action] = useActionState(inviteMember, INITIAL);
  const link = state.data?.invitationUrl;

  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
        <ToolbarField label="E-Mail-Adresse" className="w-full sm:w-64">
          <Input
            name="email"
            type="email"
            required
            placeholder="kollege@agentur.de"
            aria-label="E-Mail-Adresse der eingeladenen Person"
          />
        </ToolbarField>
        <ToolbarField label="Rolle" className="w-36">
          <Select name="role" defaultValue="MEMBER">
            {ORGANIZATION_ROLES.map((role) => (
              <option key={role} value={role}>
                {ORGANIZATION_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </ToolbarField>
        <Submit idle="Einladung erstellen" busy="Wird erstellt …" size="md" variant="primary" />
      </form>

      {state.message && !link ? (
        <Alert tone={state.ok ? "success" : "error"}>
          {state.message}
          {state.errors?.email ? ` ${state.errors.email}` : ""}
        </Alert>
      ) : null}

      {link ? <InvitationLink url={link} message={state.message} /> : null}

      <p className="text-[11px] leading-relaxed text-slate-500">
        Es wird keine E-Mail verschickt – dafür ist kein Versanddienst eingerichtet. Der Link wird
        hier einmalig angezeigt und von dir weitergegeben. Er gilt 14 Tage und kann nur von einem
        Konto mit genau dieser E-Mail-Adresse eingelöst werden.
      </p>
    </div>
  );
}

/** Zeigt den Link einmalig an – er lässt sich danach nicht erneut abrufen. */
function InvitationLink({ url, message }: { url: string; message?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Alert tone="success" title={message ?? "Einladung erstellt"}>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded border border-emerald-200 bg-white px-1.5 py-1 font-mono text-[11px] text-slate-700">
          {url}
        </code>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Kopiert" : "Kopieren"}
        </Button>
      </div>
      <p className="mt-1 text-[11px]">
        Der Link wird nur jetzt angezeigt. Notiere ihn, bevor du die Seite verlässt.
      </p>
    </Alert>
  );
}

export function InvitationTable({ invitations }: { invitations: Invitation[] }) {
  if (invitations.length === 0) {
    return <EmptyState compact title="Keine Einladungen" />;
  }

  return (
    <TableWrap>
      <Table>
        <Thead>
          <tr>
            <Th>E-Mail</Th>
            <Th>Rolle</Th>
            <Th>Status</Th>
            <Th align="right" className="hidden sm:table-cell">
              Gültig bis
            </Th>
            <Th align="right">Aktion</Th>
          </tr>
        </Thead>
        <tbody>
          {invitations.map((invitation) => (
            <Tr key={invitation.id}>
              <Td className="text-slate-800">{invitation.email}</Td>
              <Td>
                <Badge>{ORGANIZATION_ROLE_LABELS[invitation.role]}</Badge>
              </Td>
              <Td>
                <Badge tone={INVITATION_STATUS_TONE[invitation.status]}>
                  {INVITATION_STATUS_LABELS[invitation.status]}
                </Badge>
              </Td>
              <Td align="right" className="hidden whitespace-nowrap text-slate-500 sm:table-cell">
                {formatDate(invitation.expiresAt)}
              </Td>
              <Td align="right">
                {invitation.status === "PENDING" ? (
                  <RevokeButton invitationId={invitation.id} />
                ) : (
                  <Blank />
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function RevokeButton({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState(revokeInvitation, INITIAL);
  return (
    <form action={action} className="flex items-center justify-end gap-1">
      <input type="hidden" name="invitationId" value={invitationId} />
      <Submit idle="Zurückziehen" busy="…" size="xs" variant="ghost" />
      {!state.ok && state.message ? (
        <span className="text-[11px] text-rose-700">{state.message}</span>
      ) : null}
    </form>
  );
}
