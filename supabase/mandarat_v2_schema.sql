-- Mandarat v2 Schema (Canonical 9x9 Model)
-- This schema separates yearly goal, strategies, and actions into distinct tables

-- Board table: one per user
create table if not exists public.mandarat_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  yearly_goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Strategies table: 8 strategies per board
create table if not exists public.mandarat_strategies (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.mandarat_boards(id) on delete cascade,
  strategy_index int not null check (strategy_index >= 0 and strategy_index < 8),
  text_value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, strategy_index)
);

-- Actions table: 64 actions per board (8 strategies x 8 actions each)
create table if not exists public.mandarat_actions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.mandarat_boards(id) on delete cascade,
  strategy_index int not null check (strategy_index >= 0 and strategy_index < 8),
  action_index int not null check (action_index >= 0 and action_index < 8),
  text_value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, strategy_index, action_index)
);

-- Enable RLS
alter table public.mandarat_boards enable row level security;
alter table public.mandarat_strategies enable row level security;
alter table public.mandarat_actions enable row level security;

-- RLS Policies for mandarat_boards
-- Users can only access their own board
create policy "Users can select their own board"
  on public.mandarat_boards
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own board"
  on public.mandarat_boards
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own board"
  on public.mandarat_boards
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own board"
  on public.mandarat_boards
  for delete
  using (auth.uid() = user_id);

-- RLS Policies for mandarat_strategies
-- Users can only access strategies of their own board
create policy "Users can select strategies of their own board"
  on public.mandarat_strategies
  for select
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_strategies.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can insert strategies to their own board"
  on public.mandarat_strategies
  for insert
  with check (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_strategies.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can update strategies of their own board"
  on public.mandarat_strategies
  for update
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_strategies.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_strategies.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can delete strategies of their own board"
  on public.mandarat_strategies
  for delete
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_strategies.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

-- RLS Policies for mandarat_actions
-- Users can only access actions of their own board
create policy "Users can select actions of their own board"
  on public.mandarat_actions
  for select
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_actions.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can insert actions to their own board"
  on public.mandarat_actions
  for insert
  with check (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_actions.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can update actions of their own board"
  on public.mandarat_actions
  for update
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_actions.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_actions.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can delete actions of their own board"
  on public.mandarat_actions
  for delete
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_actions.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

