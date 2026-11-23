export type RsvpStatus = "pending" | "confirmed" | "declined";

export type VenueLike = {
  name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CalendarInfo = {
  available: boolean;
  missing_reason: string | null;
  google_url: string | null;
  ics_url: string | null;
  start_instant: string | null;
  end_instant: string | null;
};

export type Venue = {
  id: string;
  name: string | null;
  address: string | null;
  references_text: string | null;
  access_notes: string | null;
  parking: string | null;
  photo_path: string | null;
  observations: string | null;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
  links: {
    google_maps_url: string | null;
    waze_url: string | null;
  };
};

export type EventDisplay = {
  date_long: string;
  date_short: string;
  arrival_time: string;
  start_time: string;
  dinner_time: string;
  end_time: string;
};

export type EventRow = {
  id: string;
  slug: string;
  name: string;
  event_date: string;
  arrival_time: string | null;
  start_time: string | null;
  dinner_time: string | null;
  end_time: string | null;
  description: string | null;
  observations: string | null;
  venue_id: string | null;
  updated_at: string;
  is_released?: boolean;
  dress_code?: string | null;
  contributions?: string | null;
  exchange_rules?: string | null;
  additional_activities?: string | null;
  registration_deadline?: string | null;
  registration_deadline_label?: string | null;
  gift_exchange_enabled: boolean;
  registration_exchange_enabled: boolean;
  display: EventDisplay;
  calendar: CalendarInfo;
};

export type EventGuest = {
  id: string;
  event_id: string;
  guest_id: string;
  status: RsvpStatus;
  status_label: string;
  public_note: string | null;
  responded_at: string | null;
};

export type AttendanceCounts = {
  total: number;
  confirmed: number;
  pending: number;
  declined: number;
};

export type Host = {
  id: string;
  event_id: string;
  guest_id: string | null;
  name: string;
  welcome_message: string | null;
  photo_path: string | null;
  venue_notes: string | null;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  event_id: string;
  name: string;
  category: string;
  category_label: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  status: string;
  status_label: string;
  notes: string | null;
  created_at: string;
  menu_item_assignees: { guest_id: string }[];
};

export type Responsibility = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  category: string;
  category_label: string;
  quantity: string | null;
  due_date: string | null;
  due_date_label: string | null;
  status: string;
  status_label: string;
  notes: string | null;
  created_at: string;
  responsibility_assignees: { guest_id: string }[];
};

export type Activity = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  start_time: string | null;
  start_time_label: string;
  end_time: string | null;
  end_time_label: string;
  responsible: string | null;
  instructions: string | null;
  sort_order: number;
};

export type Announcement = {
  id: string;
  event_id: string | null;
  event_name: string;
  event_slug: string | null;
  title: string;
  content: string;
  category: string;
  category_label: string;
  priority: string;
  priority_label: string;
  published_at: string;
  published_at_label: string;
  is_active: boolean;
};

export type Family = {
  id: string;
  name: string;
  sort_order: number;
  is_unassigned: boolean;
  guests_count: number;
  created_at: string;
};

export type Guest = {
  id: string;
  full_name: string;
  avatar: string | null;
  family_id: string | null;
  family_name: string | null;
  tag: string | null;
  created_at: string;
};

export type AdminGuest = Guest & {
  email: string | null;
  event_statuses: {
    id: string;
    event_id: string;
    event_slug: string;
    event_name: string;
    status: RsvpStatus;
    status_label: string;
    public_note: string | null;
    participates_in_exchange: boolean;
    gift_suggestions: string | null;
    registered_at: string | null;
    responded_at: string | null;
  }[];
  private: {
    dietary_notes: string | null;
    admin_notes: string | null;
    updated_at: string;
  } | null;
  invitation_tokens: {
    id: string;
    token: string;
    created_at: string;
    revoked_at: string | null;
  }[];
};

export type EventSummary = EventRow & {
  venue: Venue | null;
  event_guests: Pick<EventGuest, "status" | "status_label">[];
  event_hosts: Pick<Host, "name">[];
  attendance_counts: AttendanceCounts;
  is_next: boolean;
};

export type EventBundle = {
  event: EventRow & { venue: Venue | null };
  attendance: (EventGuest & { guest: Guest })[];
  hosts: Host[];
  menu: MenuItem[];
  responsibilities: Responsibility[];
  activities: Activity[];
  announcements: Announcement[];
  attendance_counts: AttendanceCounts;
};

export type Participant = {
  id: string;
  full_name: string;
  avatar: string | null;
  family_id: string | null;
  family_name: string | null;
  tag: string | null;
  event_statuses: {
    event_id: string;
    event_slug: string;
    event_name: string;
    status: RsvpStatus;
    status_label: string;
  }[];
};

export type Invitation = {
  guest: { id: string; full_name: string };
  events: {
    event_id: string;
    slug: string;
    name: string;
    event_date: string;
    start_time: string | null;
    start_time_label: string;
    status: RsvpStatus;
    status_label: string;
    calendar: CalendarInfo;
  }[];
  responsibilities: {
    id: string;
    title: string;
    event_slug: string;
    event_name: string;
    status: string;
    status_label: string;
    quantity: string | null;
    due_date: string | null;
    kind: "tarea" | "platillo";
  }[];
};

export type UpcomingEvent = Pick<EventSummary, "id" | "slug" | "name" | "event_date" | "description" | "display" | "venue">;

export type HomePayload = {
  upcoming_events?: UpcomingEvent[];
  events: EventSummary[];
  announcements: Announcement[];
  next_event: EventSummary | null;
  featured_announcements: Announcement[];
};

export type AdminStats = {
  events: number;
  guests: number;
  families: number;
  active_announcements: number;
  registrations: number;
  rsvp: AttendanceCounts;
  menu_items: number;
  responsibilities: number;
  activities: number;
  invitation_tokens: {
    total: number;
    active: number;
    revoked: number;
  };
};

export type Registration = {
  id: string;
  event_id: string;
  event_slug: string;
  event_name: string;
  event_date: string;
  event_date_label: string;
  guest_id: string;
  full_name: string;
  avatar: string | null;
  email: string | null;
  family_name: string | null;
  status: RsvpStatus;
  status_label: string;
  participates_in_exchange: boolean;
  gift_suggestions: string | null;
  registered_at: string;
};
