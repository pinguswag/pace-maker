-- Mandarat MVP Schema
-- One board per user, 64 cells (8x8 grid)

-- Board table: one per user
create table if not exists public.mandarat_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  yearly_goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cells table: 64 cells per board (8 rows x 8 columns)
create table if not exists public.mandarat_cells (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.mandarat_boards(id) on delete cascade,
  row_index int not null,
  col_index int not null,
  text_value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, row_index, col_index)
);

-- Enable RLS
alter table public.mandarat_boards enable row level security;
alter table public.mandarat_cells enable row level security;

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

-- RLS Policies for mandarat_cells
-- Users can only access cells of their own board
create policy "Users can select cells of their own board"
  on public.mandarat_cells
  for select
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_cells.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can insert cells to their own board"
  on public.mandarat_cells
  for insert
  with check (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_cells.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can update cells of their own board"
  on public.mandarat_cells
  for update
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_cells.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_cells.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

create policy "Users can delete cells of their own board"
  on public.mandarat_cells
  for delete
  using (
    exists (
      select 1 from public.mandarat_boards
      where mandarat_boards.id = mandarat_cells.board_id
      and mandarat_boards.user_id = auth.uid()
    )
  );

