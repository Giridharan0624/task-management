# Chat Feature — Implementation Plan

## Why Chat?

### The Problem
Currently, team communication in TaskFlow happens through:
- **Progress comments** on tasks — limited to task context only
- **External tools** (WhatsApp, Slack, email) — context switching, no audit trail in TaskFlow

This creates gaps:
1. Quick questions require leaving the app
2. No record of informal discussions that led to decisions
3. No way to discuss topics that span multiple tasks/projects
4. Day-off coordination happens outside the system
5. New employees have no way to ask questions without knowing which task to comment on

### The Value
Chat inside TaskFlow means:
- **Zero context switching** — discuss and act in the same place
- **Audit trail** — all conversations are logged alongside work
- **Role-aware** — messages respect the same RBAC hierarchy
- **Task linking** — reference tasks/projects directly in chat
- **Async-friendly** — works for distributed/remote teams across timezones

---

## Where to Place Chat in the App

### Option A: Sidebar Chat Panel (Recommended)
```
┌──────────┬─────────────────────────┬──────────┐
│          │                         │          │
│ Nav      │    Current Page         │  Chat    │
│ Sidebar  │    (Dashboard/Tasks/    │  Panel   │
│          │     Projects/etc.)      │  (320px) │
│          │                         │          │
│          │                         │ Messages │
│          │                         │ here     │
│          │                         │          │
│          │                         │ [input]  │
└──────────┴─────────────────────────┴──────────┘
```
- Collapsible right-side panel (like Slack's thread view)
- Available on every page without navigation
- Toggle with a chat icon in the sidebar nav
- Doesn't interfere with existing layout
- Can be minimized to a floating bubble

### Option B: Dedicated Chat Page
```
/chat — Full page with conversation list + message area
```
- Separate route like other pages
- More space for messages
- But requires leaving the current page

### Option C: Floating Chat Widget
```
Small bubble in bottom-right corner → expands to chat window
```
- Always accessible
- Minimal footprint
- But limited screen real estate

**Recommendation: Option A (Sidebar Panel)** with a fallback to Option C (floating bubble) on mobile. The sidebar approach keeps chat accessible without leaving the current context, and mirrors how tools like Linear, Notion, and ClickUp handle in-app messaging.

---

## Chat Types to Implement

### 1. Direct Messages (DM)
- One-on-one private conversations between any two users
- Encrypted, visible only to the two participants
- Use case: Quick questions, private feedback, HR discussions

### 2. Project Channels
- Auto-created when a project is created
- All project members can see messages
- Use case: Project-specific discussions, decisions, blockers
- Messages can reference tasks within the project

### 3. Department Channels
- Auto-created per department (Development, Designing, etc.)
- All users in that department are auto-joined
- Use case: Department announcements, team coordination

### 4. General Channel
- Company-wide channel visible to everyone
- Use case: Announcements, company updates, celebrations

### 5. Task Threads (Enhancement to existing)
- Upgrade the existing "Progress Updates" on tasks to feel like a chat thread
- Real-time updates instead of page refresh
- Typing indicators, read receipts

---

## Technical Architecture

### Real-Time Options

| Approach | Pros | Cons | Cost |
|----------|------|------|------|
| **WebSocket via API Gateway** | Native AWS, serverless, scales | Connection management complex | $0.25/million messages |
| **AWS AppSync (GraphQL)** | Built-in subscriptions, offline sync | Learning curve, GraphQL migration | $4/million queries |
| **Pusher / Ably** | Simple SDK, handles scaling | Third-party dependency, recurring cost | $49-399/month |
| **Socket.io on EC2/ECS** | Full control, familiar API | Not serverless, needs server management | EC2/ECS costs |
| **Polling (Simple)** | No infrastructure change, works now | Not real-time (5-10s delay), more API calls | Higher Lambda costs |

**Recommendation: API Gateway WebSockets** — stays serverless, native AWS, scales automatically, and integrates with existing DynamoDB + Lambda stack.

### Architecture Diagram
```
Frontend (Next.js)
  │
  ├── REST API (existing) ──→ API Gateway REST ──→ Lambda ──→ DynamoDB
  │
  └── WebSocket ──→ API Gateway WebSocket ──→ Lambda
                         │                       │
                         ├── $connect             ├── Store connection in DynamoDB
                         ├── $disconnect          ├── Remove connection
                         ├── sendMessage          ├── Save message + broadcast
                         ├── typing               ├── Broadcast typing indicator
                         └── markRead             └── Update read receipts
                                                       │
                                                       ↓
                                                  DynamoDB
                                                  (Messages table)
```

### Data Model

**Message Entity:**
```
PK: CHANNEL#{channel_id}
SK: MSG#{timestamp}#{message_id}

Fields:
- message_id (UUID)
- channel_id
- sender_id
- sender_name
- content (text, max 4000 chars)
- message_type (TEXT, SYSTEM, TASK_REF, FILE)
- referenced_task_id (optional — links to a task)
- referenced_project_id (optional)
- attachments (list of file URLs, optional)
- reactions (map of emoji → user_ids)
- edited_at (optional)
- deleted (boolean, soft delete)
- created_at
```

**Channel Entity:**
```
PK: ORG_CHANNELS#{org_id}   (or CHANNEL#{channel_id} for direct lookup)
SK: CHANNEL#{channel_id}

Fields:
- channel_id (UUID)
- org_id
- type (DM, PROJECT, DEPARTMENT, GENERAL)
- name (for group channels)
- members (list of user_ids)
- project_id (for project channels)
- department (for department channels)
- last_message_at
- created_at
```

**Connection Entity (for WebSocket):**
```
PK: WS_CONN#{connection_id}
SK: META

Fields:
- connection_id (API Gateway WebSocket connection ID)
- user_id
- org_id
- connected_at

GSI: USER_CONN#{user_id} → for finding all connections of a user
```

**Read Receipt Entity:**
```
PK: READ#{channel_id}
SK: USER#{user_id}

Fields:
- last_read_message_id
- last_read_at
```

### Message Flow
```
1. User types message in chat panel
2. Frontend sends via WebSocket: { action: "sendMessage", channelId, content }
3. Lambda handler:
   a. Validates user is member of channel
   b. Saves message to DynamoDB
   c. Queries all active WebSocket connections for channel members
   d. Broadcasts message to all connected members via API Gateway @connections
4. Recipients receive message in real-time via WebSocket onMessage
5. If recipient is offline, message waits in DynamoDB (loaded on next connect)
```

---

## Frontend Implementation

### New Components
```
frontend/src/components/chat/
├── ChatPanel.tsx          — Main collapsible right panel
├── ChatSidebar.tsx        — Channel list (DMs, projects, departments)
├── MessageList.tsx        — Scrollable message area with infinite scroll
├── MessageBubble.tsx      — Individual message (avatar, name, time, content)
├── ChatInput.tsx          — Text input with send button, emoji, file attach
├── ChannelHeader.tsx      — Channel name, members count, settings
├── TypingIndicator.tsx    — "John is typing..." animation
├── UnreadBadge.tsx        — Red dot with count on channel name
├── TaskReference.tsx      — Inline task card when a task is referenced
└── ChatToggle.tsx         — Button in sidebar nav to open/close chat
```

### New Hooks
```
frontend/src/lib/hooks/
├── useWebSocket.ts        — WebSocket connection manager (connect, reconnect, heartbeat)
├── useChat.ts             — Send/receive messages, channel management
├── useChannels.ts         — List channels, unread counts
└── useTyping.ts           — Typing indicator logic (debounced)
```

### Chat Toggle in Sidebar
Add a chat icon to the sidebar navigation:
```
Dashboard
All Tasks
Task Updates
Users
Projects
Attendance
Day Offs
Profile
────────────
💬 Chat (with unread badge)
```

### Chat Panel Behavior
- **Desktop**: Slides in from the right (320px wide), pushes main content left
- **Mobile**: Opens as full-screen overlay
- **Collapsed state**: Small floating bubble in bottom-right with unread count
- **Keyboard shortcut**: `Ctrl+Shift+C` to toggle
- **Notification sound**: Optional, configurable per user

---

## Backend Implementation

### New Lambda Handlers
```
backend/src/handlers/chat/
├── connect.py             — WebSocket $connect (store connection)
├── disconnect.py          — WebSocket $disconnect (remove connection)
├── send_message.py        — Save message + broadcast to channel members
├── get_messages.py        — REST: GET /channels/{id}/messages (paginated)
├── get_channels.py        — REST: GET /channels (list user's channels)
├── create_channel.py      — REST: POST /channels (create DM or group)
├── mark_read.py           — WebSocket: update read receipt
├── typing.py              — WebSocket: broadcast typing indicator
├── edit_message.py        — REST: PUT /channels/{id}/messages/{msgId}
└── delete_message.py      — REST: DELETE /channels/{id}/messages/{msgId}
```

### CDK Changes
```python
# New WebSocket API
ws_api = apigw.WebSocketApi(self, "ChatWebSocket")
ws_stage = apigw.WebSocketStage(self, "ChatWsStage", web_socket_api=ws_api, stage_name="prod")

# Routes
ws_api.add_route("$connect", integration=connect_lambda)
ws_api.add_route("$disconnect", integration=disconnect_lambda)
ws_api.add_route("sendMessage", integration=send_message_lambda)
ws_api.add_route("typing", integration=typing_lambda)
ws_api.add_route("markRead", integration=mark_read_lambda)

# REST endpoints for chat history
add_api_lambda("GetChannels", "handlers.chat.get_channels.handler", "GET", channels)
add_api_lambda("GetMessages", "handlers.chat.get_messages.handler", "GET", channel_messages)
add_api_lambda("CreateChannel", "handlers.chat.create_channel.handler", "POST", channels)
```

---

## Feature Breakdown by Priority

### MVP (Phase 1 — 2-3 weeks)
- [ ] WebSocket infrastructure (connect/disconnect/heartbeat)
- [ ] Direct messages between two users
- [ ] General company channel
- [ ] Message sending and receiving in real-time
- [ ] Chat panel UI (collapsible sidebar)
- [ ] Message history (paginated, loaded via REST)
- [ ] Unread message count badge
- [ ] Basic notifications (browser tab title shows unread count)

### Phase 2 (2 weeks)
- [ ] Project channels (auto-created with project)
- [ ] Department channels
- [ ] Task references in messages (type `#task-name` to link)
- [ ] Read receipts (seen indicators)
- [ ] Typing indicators
- [ ] Message search

### Phase 3 (2 weeks)
- [ ] File/image sharing (upload to S3, display inline)
- [ ] Emoji reactions on messages
- [ ] Edit/delete messages
- [ ] Pin important messages
- [ ] Message threads (reply to specific message)
- [ ] @mention users (with notification)

### Phase 4 (Future)
- [ ] Voice/video calls (via WebRTC or Twilio)
- [ ] Screen sharing
- [ ] Message formatting (markdown, code blocks)
- [ ] Bot integrations (automated messages from system events)
- [ ] Message scheduling
- [ ] Export chat history

---

## Why Not Use a Third-Party Chat SDK?

| Option | Pros | Cons |
|--------|------|------|
| **Build custom** | Full control, no recurring cost, data stays in AWS | More dev time |
| **Stream Chat** | Ready-made UI, real-time | $499+/month, data leaves your infra |
| **Sendbird** | Feature-rich, SDKs | $399+/month, vendor lock-in |
| **Firebase** | Free tier, easy setup | Google ecosystem, data in Firebase |

**Recommendation: Build custom** — TaskFlow is already on AWS with DynamoDB + Lambda. Adding WebSocket via API Gateway keeps everything in the same ecosystem, avoids recurring SaaS costs, and keeps all chat data in your DynamoDB alongside task/project data. The integration with existing entities (tasks, projects, users) is also much tighter when built custom.

---

## Cost Estimate (AWS)

| Component | Monthly Cost (100 users) |
|-----------|-------------------------|
| API Gateway WebSocket | ~$1-5 (connection minutes + messages) |
| Lambda (chat handlers) | ~$2-10 (invocations) |
| DynamoDB (messages) | ~$5-15 (storage + read/write) |
| S3 (file attachments) | ~$1-5 (storage) |
| **Total** | **~$10-35/month** |

Extremely cost-effective compared to third-party chat SDKs ($400-500/month).

---

## Integration Points with Existing Features

| Existing Feature | Chat Integration |
|-----------------|-----------------|
| **Task creation** | System message in project channel: "John created task 'Fix bug'" |
| **Task assignment** | DM notification: "You were assigned to 'Fix bug'" |
| **Task status change** | Project channel: "Task 'Fix bug' moved to DONE" |
| **Day-off approval** | DM to requester: "Your day-off was approved by CEO" |
| **New member added** | Project channel: "Asfar was added to the project" |
| **Timer start/stop** | Optional: "Asfar started working on 'Fix bug'" |
| **Task update submitted** | Channel: "Asfar submitted their task update" |
| **New user created** | General channel: "Welcome Giri to the team!" |

These system messages make chat the **central activity feed** for the entire organization.
