import {
  calendarInfo,
  dateOnly,
  decimal,
  eventDayEnd,
  eventStartTime,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatTime,
  googleMapsUrl,
  isoDate,
  isoRequired,
  timeOnly,
  wazeUrl,
  type DateLike,
} from "../lib/dates.js";
import {
  announcementCategoryLabel,
  announcementPriorityLabel,
  menuCategoryLabel,
  menuStatusLabel,
  PRIORITY_RANK,
  responsibilityCategoryLabel,
  responsibilityStatusLabel,
  rsvpLabel,
} from "../lib/labels.js";
import { hasGiftExchange } from "../lib/event-rules.js";
import type {
  Activity,
  AdminGuest,
  Announcement,
  AttendanceCounts,
  EventGuest,
  EventRow,
  EventSummary,
  Family,
  Guest,
  Host,
  Invitation,
  MenuItem,
  Participant,
  Registration,
  Responsibility,
  RsvpStatus,
  Venue,
} from "../types.js";

export type VenueRecord = {
  id: string;
  name: string | null;
  address: string | null;
  referencesText: string | null;
  accessNotes: string | null;
  parking: string | null;
  photoPath: string | null;
  observations: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: DateLike;
};

export type EventRecord = {
  id: string;
  slug: string;
  name: string;
  giftExchangeEnabled?: boolean;
  eventDate: DateLike;
  arrivalTime: DateLike | null;
  startTime: DateLike | null;
  dinnerTime: DateLike | null;
  endTime: DateLike | null;
  description: string | null;
  observations: string | null;
  venueId: string | null;
  updatedAt: DateLike;
};

export function mapVenue(venue: VenueRecord): Venue {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    references_text: venue.referencesText,
    access_notes: venue.accessNotes,
    parking: venue.parking,
    photo_path: venue.photoPath,
    observations: venue.observations,
    latitude: venue.latitude,
    longitude: venue.longitude,
    updated_at: isoRequired(venue.updatedAt),
    links: {
      google_maps_url: googleMapsUrl(venue),
      waze_url: wazeUrl(venue),
    },
  };
}

export function mapEvent(event: EventRecord, venue: VenueRecord | null): EventRow {
  const eventDate = dateOnly(event.eventDate);
  const arrivalTime = timeOnly(event.arrivalTime);
  const startTime = timeOnly(event.startTime);
  const dinnerTime = timeOnly(event.dinnerTime);
  const endTime = timeOnly(event.endTime);

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    event_date: eventDate,
    arrival_time: arrivalTime,
    start_time: startTime,
    dinner_time: dinnerTime,
    end_time: endTime,
    description: event.description,
    observations: event.observations,
    venue_id: event.venueId,
    updated_at: isoRequired(event.updatedAt),
    gift_exchange_enabled: hasGiftExchange(event),
    display: {
      date_long: formatDateLong(eventDate),
      date_short: formatDateShort(eventDate),
      arrival_time: formatTime(arrivalTime),
      start_time: formatTime(startTime),
      dinner_time: formatTime(dinnerTime),
      end_time: formatTime(endTime),
    },
    calendar: calendarInfo(
      {
        name: event.name,
        event_date: eventDate,
        arrival_time: arrivalTime,
        start_time: startTime,
        end_time: endTime,
        description: event.description,
        venue: venue
          ? {
              name: venue.name,
              address: venue.address,
              latitude: venue.latitude,
              longitude: venue.longitude,
            }
          : null,
      },
      event.slug,
    ),
  };
}

export type EventGuestRecord = {
  id: string;
  eventId: string;
  guestId: string;
  status: string;
  publicNote: string | null;
  participatesInExchange: boolean;
  giftSuggestions: string | null;
  registeredAt: DateLike | null;
  respondedAt: DateLike | null;
};

export function mapEventGuest(eventGuest: EventGuestRecord): EventGuest {
  return {
    id: eventGuest.id,
    event_id: eventGuest.eventId,
    guest_id: eventGuest.guestId,
    status: eventGuest.status as RsvpStatus,
    status_label: rsvpLabel(eventGuest.status),
    public_note: eventGuest.publicNote,
    responded_at: isoDate(eventGuest.respondedAt),
  };
}

export type HostRecord = {
  id: string;
  eventId: string;
  guestId: string | null;
  name: string;
  welcomeMessage: string | null;
  photoPath: string | null;
  venueNotes: string | null;
  sortOrder: number;
};

export function mapHost(host: HostRecord): Host {
  return {
    id: host.id,
    event_id: host.eventId,
    guest_id: host.guestId,
    name: host.name,
    welcome_message: host.welcomeMessage,
    photo_path: host.photoPath,
    venue_notes: host.venueNotes,
    sort_order: host.sortOrder,
  };
}

export type MenuRecord = {
  id: string;
  eventId: string;
  name: string;
  category: string;
  description: string | null;
  quantity: { toString(): string } | number | null;
  unit: string | null;
  status: string;
  notes: string | null;
  createdAt: DateLike;
  assignees: { guestId: string }[];
};

export function mapMenu(item: MenuRecord): MenuItem {
  return {
    id: item.id,
    event_id: item.eventId,
    name: item.name,
    category: item.category,
    category_label: menuCategoryLabel(item.category),
    description: item.description,
    quantity: decimal(item.quantity),
    unit: item.unit,
    status: item.status,
    status_label: menuStatusLabel(item.status),
    notes: item.notes,
    created_at: isoRequired(item.createdAt),
    menu_item_assignees: item.assignees.map((assignee) => ({ guest_id: assignee.guestId })),
  };
}

export type ResponsibilityRecord = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  category: string;
  quantity: string | null;
  dueDate: DateLike | null;
  status: string;
  notes: string | null;
  createdAt: DateLike;
  assignees: { guestId: string }[];
};

export function mapResponsibility(item: ResponsibilityRecord): Responsibility {
  const dueDate = item.dueDate == null ? null : dateOnly(item.dueDate);
  return {
    id: item.id,
    event_id: item.eventId,
    title: item.title,
    description: item.description,
    category: item.category,
    category_label: responsibilityCategoryLabel(item.category),
    quantity: item.quantity,
    due_date: dueDate,
    due_date_label:
      dueDate == null
        ? null
        : new Intl.DateTimeFormat("es-MX", {
            timeZone: "America/Mexico_City",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date(`${dueDate}T12:00:00-06:00`)),
    status: item.status,
    status_label: responsibilityStatusLabel(item.status),
    notes: item.notes,
    created_at: isoRequired(item.createdAt),
    responsibility_assignees: item.assignees.map((assignee) => ({
      guest_id: assignee.guestId,
    })),
  };
}

export type ActivityRecord = {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  startTime: DateLike | null;
  endTime: DateLike | null;
  responsible: string | null;
  instructions: string | null;
  sortOrder: number;
};

export function mapActivity(activity: ActivityRecord): Activity {
  const startTime = timeOnly(activity.startTime);
  const endTime = timeOnly(activity.endTime);
  return {
    id: activity.id,
    event_id: activity.eventId,
    name: activity.name,
    description: activity.description,
    start_time: startTime,
    start_time_label: formatTime(startTime),
    end_time: endTime,
    end_time_label: formatTime(endTime),
    responsible: activity.responsible,
    instructions: activity.instructions,
    sort_order: activity.sortOrder,
  };
}

export type AnnouncementRecord = {
  id: string;
  eventId: string | null;
  title: string;
  content: string;
  category: string;
  priority: string;
  publishedAt: DateLike;
  isActive: boolean;
};

export function mapAnnouncement(
  announcement: AnnouncementRecord,
  event?: { name: string; slug: string } | null,
): Announcement {
  return {
    id: announcement.id,
    event_id: announcement.eventId,
    event_name: event?.name ?? "Ambas celebraciones",
    event_slug: event?.slug ?? null,
    title: announcement.title,
    content: announcement.content,
    category: announcement.category,
    category_label: announcementCategoryLabel(announcement.category),
    priority: announcement.priority,
    priority_label: announcementPriorityLabel(announcement.priority),
    published_at: isoRequired(announcement.publishedAt),
    published_at_label: formatDateTime(announcement.publishedAt),
    is_active: announcement.isActive,
  };
}

export type FamilyRecord = {
  id: string;
  name: string;
  sortOrder: number;
  isUnassigned: boolean;
  createdAt: DateLike;
  _count?: { guests: number };
};

export function mapFamily(family: FamilyRecord): Family {
  return {
    id: family.id,
    name: family.name,
    sort_order: family.sortOrder,
    is_unassigned: family.isUnassigned,
    guests_count: family._count?.guests ?? 0,
    created_at: isoRequired(family.createdAt),
  };
}

export type GuestRecord = {
  id: string;
  fullName: string;
  avatar?: string | null;
  email?: string | null;
  familyId: string | null;
  tag: string | null;
  createdAt: DateLike;
  family?: { name: string } | null;
};

export function mapGuest(guest: GuestRecord): Guest {
  return {
    id: guest.id,
    full_name: guest.fullName,
    avatar: guest.avatar ?? null,
    family_id: guest.familyId,
    family_name: guest.family?.name ?? null,
    tag: guest.tag,
    created_at: isoRequired(guest.createdAt),
  };
}

export function countStatuses(rows: { status: string }[]): AttendanceCounts {
  const counts: AttendanceCounts = { total: rows.length, confirmed: 0, pending: 0, declined: 0 };
  for (const row of rows) {
    if (row.status === "confirmed") counts.confirmed++;
    else if (row.status === "declined") counts.declined++;
    else counts.pending++;
  }
  return counts;
}

export function mapEventSummary(
  event: EventRecord,
  venue: VenueRecord | null,
  guests: { status: string }[],
  hosts: { name: string }[],
  isNext: boolean,
): EventSummary {
  return {
    ...mapEvent(event, venue),
    venue: venue ? mapVenue(venue) : null,
    event_guests: guests.map((guest) => ({
      status: guest.status as RsvpStatus,
      status_label: rsvpLabel(guest.status),
    })),
    event_hosts: hosts.map((host) => ({ name: host.name })),
    attendance_counts: countStatuses(guests),
    is_next: isNext,
  };
}

export function nextEventId(
  events: { id: string; eventDate: DateLike }[],
  now = new Date(),
): string | null {
  for (const event of events) {
    if (eventDayEnd(dateOnly(event.eventDate)) > now) return event.id;
  }
  return null;
}

export function sortAnnouncements<T extends { priority: string; published_at: string }>(
  list: T[],
): T[] {
  return [...list].sort(
    (a, b) =>
      (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) ||
      b.published_at.localeCompare(a.published_at),
  );
}

export function featuredAnnouncements<T extends { priority: string; published_at: string }>(
  list: T[],
): T[] {
  const sorted = sortAnnouncements(list);
  const highlighted = sorted.filter((announcement) => announcement.priority !== "normal");
  return (highlighted.length ? highlighted : sorted).slice(0, highlighted.length ? 4 : 3);
}

export type EventGuestWithEventRecord = EventGuestRecord & {
  event: { id: string; slug: string; name: string; eventDate: DateLike; startTime: DateLike | null; arrivalTime: DateLike | null };
};

export function mapParticipant(
  guest: GuestRecord,
  eventGuests: EventGuestWithEventRecord[],
): Participant {
  return {
    id: guest.id,
    full_name: guest.fullName,
    avatar: guest.avatar ?? null,
    family_id: guest.familyId,
    family_name: guest.family?.name ?? null,
    tag: guest.tag,
    event_statuses: eventGuests.map((eventGuest) => ({
      event_id: eventGuest.event.id,
      event_slug: eventGuest.event.slug,
      event_name: eventGuest.event.name,
      status: eventGuest.status as RsvpStatus,
      status_label: rsvpLabel(eventGuest.status),
    })),
  };
}

export type RegistrationRecord = {
  id: string;
  status: string;
  participatesInExchange: boolean;
  giftSuggestions: string | null;
  registeredAt: DateLike;
  guest: {
    id: string;
    fullName: string;
    avatar?: string | null;
    email: string | null;
    family?: { name: string } | null;
  };
  event: {
    id: string;
    slug: string;
    name: string;
    eventDate: DateLike;
  };
};

export function mapRegistration(row: RegistrationRecord): Registration {
  const eventDate = dateOnly(row.event.eventDate);
  return {
    id: row.id,
    event_id: row.event.id,
    event_slug: row.event.slug,
    event_name: row.event.name,
    event_date: eventDate,
    event_date_label: formatDateLong(eventDate),
    guest_id: row.guest.id,
    full_name: row.guest.fullName,
    avatar: row.guest.avatar ?? null,
    email: row.guest.email,
    family_name: row.guest.family?.name ?? null,
    status: row.status as RsvpStatus,
    status_label: rsvpLabel(row.status),
    participates_in_exchange: row.participatesInExchange,
    gift_suggestions: row.giftSuggestions,
    registered_at: isoRequired(row.registeredAt),
  };
}

export type AdminGuestRecord = GuestRecord & {
  private?: {
    dietaryNotes: string | null;
    adminNotes: string | null;
    updatedAt: DateLike;
  } | null;
  eventGuests?: EventGuestWithEventRecord[];
  invitationTokens?: {
    id: string;
    token: string;
    createdAt: DateLike;
    revokedAt: DateLike | null;
  }[];
};

export function mapAdminGuest(guest: AdminGuestRecord): AdminGuest {
  return {
    ...mapGuest(guest),
    email: guest.email ?? null,
    event_statuses: (guest.eventGuests ?? []).map((eventGuest) => ({
      id: eventGuest.id,
      event_id: eventGuest.event.id,
      event_slug: eventGuest.event.slug,
      event_name: eventGuest.event.name,
      status: eventGuest.status as RsvpStatus,
      status_label: rsvpLabel(eventGuest.status),
      public_note: eventGuest.publicNote,
      participates_in_exchange: eventGuest.participatesInExchange,
      gift_suggestions: eventGuest.giftSuggestions,
      registered_at: isoDate(eventGuest.registeredAt),
      responded_at: isoDate(eventGuest.respondedAt),
    })),
    private: guest.private
      ? {
          dietary_notes: guest.private.dietaryNotes,
          admin_notes: guest.private.adminNotes,
          updated_at: isoRequired(guest.private.updatedAt),
        }
      : null,
    invitation_tokens: (guest.invitationTokens ?? []).map((token) => ({
      id: token.id,
      token: token.token,
      created_at: isoRequired(token.createdAt),
      revoked_at: isoDate(token.revokedAt),
    })),
  };
}

export type InvitationRecord = {
  guest: { id: string; fullName: string };
  eventGuests: {
    status: string;
    event: EventRecord;
    venue: VenueRecord | null;
  }[];
  responsibilityAssignments: {
    responsibility: {
      id: string;
      title: string;
      quantity: string | null;
      dueDate: DateLike | null;
      status: string;
      event: { slug: string; name: string };
    };
  }[];
  menuAssignments: {
    menuItem: {
      id: string;
      name: string;
      quantity: { toString(): string } | number | null;
      unit: string | null;
      status: string;
      event: { slug: string; name: string };
    };
  }[];
};

export function mapInvitation(record: InvitationRecord): Invitation {
  const events = record.eventGuests
    .map((eventGuest) => {
      const eventDate = dateOnly(eventGuest.event.eventDate);
      const startTime = timeOnly(
        eventGuest.event.startTime ?? eventGuest.event.arrivalTime,
      );
      return {
        event_id: eventGuest.event.id,
        slug: eventGuest.event.slug,
        name: eventGuest.event.name,
        event_date: eventDate,
        start_time: startTime,
        start_time_label: formatTime(startTime),
        status: eventGuest.status as RsvpStatus,
        status_label: rsvpLabel(eventGuest.status),
        calendar: calendarInfo(
          {
            name: eventGuest.event.name,
            event_date: eventDate,
            arrival_time: timeOnly(eventGuest.event.arrivalTime),
            start_time: timeOnly(eventGuest.event.startTime),
            end_time: timeOnly(eventGuest.event.endTime),
            description: eventGuest.event.description,
            venue: eventGuest.venue
              ? {
                  name: eventGuest.venue.name,
                  address: eventGuest.venue.address,
                  latitude: eventGuest.venue.latitude,
                  longitude: eventGuest.venue.longitude,
                }
              : null,
          },
          eventGuest.event.slug,
        ),
      };
    })
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const responsibilities: Invitation["responsibilities"] = [];

  for (const assignment of record.responsibilityAssignments) {
    const responsibility = assignment.responsibility;
    responsibilities.push({
      id: responsibility.id,
      title: responsibility.title,
      event_slug: responsibility.event.slug,
      event_name: responsibility.event.name,
      status: responsibility.status,
      status_label: responsibilityStatusLabel(responsibility.status),
      quantity: responsibility.quantity,
      due_date: responsibility.dueDate == null ? null : dateOnly(responsibility.dueDate),
      kind: "tarea",
    });
  }

  for (const assignment of record.menuAssignments) {
    const menuItem = assignment.menuItem;
    responsibilities.push({
      id: menuItem.id,
      title: menuItem.name,
      event_slug: menuItem.event.slug,
      event_name: menuItem.event.name,
      status: menuItem.status,
      status_label: menuStatusLabel(menuItem.status),
      quantity:
        menuItem.quantity != null
          ? `${Number(menuItem.quantity.toString())} ${menuItem.unit ?? ""}`.trim()
          : null,
      due_date: null,
      kind: "platillo",
    });
  }

  return {
    guest: { id: record.guest.id, full_name: record.guest.fullName },
    events,
    responsibilities,
  };
}

export function eventStartLabel(event: EventRecord): string {
  return formatTime(eventStartTime({
    arrival_time: timeOnly(event.arrivalTime),
    start_time: timeOnly(event.startTime),
  }));
}
