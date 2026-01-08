-- Initial schema for hausdog
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Properties (houses/buildings the user owns)
create table properties (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    address text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Categories (HVAC, Plumbing, Electrical, Appliances, etc.)
create table categories (
    id uuid primary key default uuid_generate_v4(),
    name text not null unique,
    icon text,
    sort_order int not null default 0
);

-- Systems (specific systems in a property)
create table systems (
    id uuid primary key default uuid_generate_v4(),
    property_id uuid not null references properties(id) on delete cascade,
    category_id uuid not null references categories(id),
    name text not null,
    manufacturer text,
    model text,
    serial_number text,
    install_date date,
    warranty_expires date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Components (parts of systems)
create table components (
    id uuid primary key default uuid_generate_v4(),
    system_id uuid not null references systems(id) on delete cascade,
    name text not null,
    manufacturer text,
    model text,
    serial_number text,
    install_date date,
    warranty_expires date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Documents (uploaded files)
create table documents (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    property_id uuid references properties(id) on delete set null,
    system_id uuid references systems(id) on delete set null,
    component_id uuid references components(id) on delete set null,
    filename text not null,
    storage_path text not null,
    content_type text not null,
    size_bytes bigint not null,
    extracted_data jsonb,
    processing_status text not null default 'pending',
    retry_count int not null default 0,
    processed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Service records (maintenance history)
create table service_records (
    id uuid primary key default uuid_generate_v4(),
    system_id uuid references systems(id) on delete cascade,
    component_id uuid references components(id) on delete cascade,
    document_id uuid references documents(id) on delete set null,
    service_date date not null,
    service_type text not null,
    provider text,
    cost decimal(10,2),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint service_record_target check (system_id is not null or component_id is not null)
);

-- Row Level Security
alter table properties enable row level security;
alter table systems enable row level security;
alter table components enable row level security;
alter table documents enable row level security;
alter table service_records enable row level security;

-- Policies: users can only access their own data
create policy "Users can manage own properties"
    on properties for all using (auth.uid() = user_id);

create policy "Users can manage systems in own properties"
    on systems for all using (
        property_id in (select id from properties where user_id = auth.uid())
    );

create policy "Users can manage components in own systems"
    on components for all using (
        system_id in (
            select s.id from systems s
            join properties p on s.property_id = p.id
            where p.user_id = auth.uid()
        )
    );

create policy "Users can manage own documents"
    on documents for all using (auth.uid() = user_id);

create policy "Users can manage service records for own systems"
    on service_records for all using (
        system_id in (
            select s.id from systems s
            join properties p on s.property_id = p.id
            where p.user_id = auth.uid()
        )
        or component_id in (
            select c.id from components c
            join systems s on c.system_id = s.id
            join properties p on s.property_id = p.id
            where p.user_id = auth.uid()
        )
    );

-- Categories are readable by all authenticated users
create policy "Categories are readable by authenticated users"
    on categories for select using (auth.role() = 'authenticated');

-- Seed default categories
insert into categories (name, icon, sort_order) values
    ('HVAC', 'thermometer', 1),
    ('Plumbing', 'droplet', 2),
    ('Electrical', 'zap', 3),
    ('Appliances', 'home', 4),
    ('Roofing', 'cloud', 5),
    ('Exterior', 'sun', 6),
    ('Interior', 'square', 7),
    ('Landscaping', 'tree', 8),
    ('Security', 'shield', 9),
    ('Other', 'more-horizontal', 10);

-- Indexes for foreign keys
create index idx_properties_user_id on properties(user_id);
create index idx_systems_property_id on systems(property_id);
create index idx_systems_category_id on systems(category_id);
create index idx_components_system_id on components(system_id);
create index idx_documents_user_id on documents(user_id);
create index idx_documents_property_id on documents(property_id);
create index idx_documents_system_id on documents(system_id);
create index idx_service_records_system_id on service_records(system_id);
create index idx_service_records_component_id on service_records(component_id);

-- Indexes for common query patterns
create index idx_documents_processing_status on documents(processing_status) where processing_status in ('pending', 'processing', 'complete');
create index idx_documents_user_status on documents(user_id, processing_status);
create index idx_documents_created_at on documents(created_at desc);
create index idx_systems_name on systems(name);
create index idx_service_records_date on service_records(service_date desc);
