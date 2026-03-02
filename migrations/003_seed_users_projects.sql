-- Seed data for users and projects
-- This migration adds test users and sample projects for development

-- Create test users with properly formatted UUIDs
-- Password for all users: password123 (bcrypt hash with cost 12)
INSERT INTO users (id, email, password_hash, username, name, avatar, role, settings, email_verified, created_at, updated_at)
VALUES 
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@example.com', '$2a$12$WHqaoe6.fnJT6tnldWGUrOqEsEWiEuEoGQUy0cn8tgP2awk0a27aW', 'admin', 'Администратор', NULL, 'admin', '{"theme": "dark", "language": "ru"}', true, NOW() - INTERVAL '90 days', NOW()),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'designer@example.com', '$2a$12$WHqaoe6.fnJT6tnldWGUrOqEsEWiEuEoGQUy0cn8tgP2awk0a27aW', 'designer', 'Дизайнер Иванов', NULL, 'user', '{"theme": "light", "language": "ru"}', true, NOW() - INTERVAL '60 days', NOW()),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'developer@example.com', '$2a$12$WHqaoe6.fnJT6tnldWGUrOqEsEWiEuEoGQUy0cn8tgP2awk0a27aW', 'developer', 'Разработчик Петров', NULL, 'user', '{"theme": "dark", "language": "ru"}', true, NOW() - INTERVAL '45 days', NOW()),
    ('d4e5f6a7-b8c9-0123-def0-234567890123', 'manager@example.com', '$2a$12$WHqaoe6.fnJT6tnldWGUrOqEsEWiEuEoGQUy0cn8tgP2awk0a27aW', 'manager', 'Менеджер Сидорова', NULL, 'user', '{"theme": "light", "language": "ru"}', true, NOW() - INTERVAL '30 days', NOW()),
    ('e5f6a7b8-c9d0-1234-ef01-345678901234', 'analyst@example.com', '$2a$12$WHqaoe6.fnJT6tnldWGUrOqEsEWiEuEoGQUy0cn8tgP2awk0a27aW', 'analyst', 'Аналитик Козлов', NULL, 'user', '{"theme": "dark", "language": "ru"}', true, NOW() - INTERVAL '15 days', NOW())
ON CONFLICT (email) DO NOTHING;

-- Create sample projects
INSERT INTO projects (id, owner_id, name, description, tags, settings, is_archived, is_public, created_at, updated_at)
VALUES 
    -- Admin's projects
    ('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Архитектура микросервисов', 'Диаграмма архитектуры микросервисного приложения с использованием Docker и Kubernetes', ARRAY['architecture', 'microservices', 'kubernetes'], '{}', false, true, NOW() - INTERVAL '80 days', NOW() - INTERVAL '5 days'),
    ('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ER Диаграмма базы данных', 'Entity-Relationship диаграмма для e-commerce платформы', ARRAY['database', 'er-diagram', 'e-commerce'], '{}', false, true, NOW() - INTERVAL '70 days', NOW() - INTERVAL '10 days'),
    
    -- Designer's projects
    ('33333333-3333-3333-3333-333333333333', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'UI Компоненты', 'Библиотека компонентов дизайн-системы', ARRAY['ui', 'components', 'design-system'], '{}', false, true, NOW() - INTERVAL '50 days', NOW() - INTERVAL '3 days'),
    ('44444444-4444-4444-4444-444444444444', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Прототип мобильного приложения', 'Wireframes и прототипы для iOS приложения', ARRAY['mobile', 'ios', 'prototype'], '{}', false, false, NOW() - INTERVAL '40 days', NOW() - INTERVAL '1 day'),
    
    -- Developer's projects  
    ('55555555-5555-5555-5555-555555555555', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'API Gateway Schema', 'Схема API Gateway с маршрутизацией и авторизацией', ARRAY['api', 'gateway', 'security'], '{}', false, true, NOW() - INTERVAL '35 days', NOW() - INTERVAL '2 days'),
    
    -- Manager's project
    ('66666666-6666-6666-6666-666666666666', 'd4e5f6a7-b8c9-0123-def0-234567890123', 'Roadmap продукта 2025', 'Дорожная карта развития продукта на 2025 год', ARRAY['roadmap', 'planning', '2025'], '{}', false, false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Create sample schemas for projects
INSERT INTO schemas (id, project_id, name, file_name, content, format_version, canvas_state, metadata, file_size, is_template, created_at, updated_at)
VALUES 
    -- Schema for microservices architecture
    ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Основная архитектура', 'main-architecture.wtv', 
     '{"nodes": [], "edges": [], "groups": []}', '1.0.0', '{"zoom": 1, "offsetX": 0, "offsetY": 0}', '{}', 1024, false, NOW() - INTERVAL '80 days', NOW() - INTERVAL '5 days'),
    
    -- Schema for ER diagram
    ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'База данных e-commerce', 'ecommerce-db.wtv',
     '{"nodes": [], "edges": [], "groups": []}', '1.0.0', '{"zoom": 1, "offsetX": 0, "offsetY": 0}', '{}', 2048, false, NOW() - INTERVAL '70 days', NOW() - INTERVAL '10 days'),
    
    -- Schema for UI components
    ('cccc3333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Компоненты v2', 'components-v2.wtv',
     '{"nodes": [], "edges": [], "groups": []}', '1.0.0', '{"zoom": 1, "offsetX": 0, "offsetY": 0}', '{}', 512, false, NOW() - INTERVAL '50 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- Create collaborators
INSERT INTO collaborators (id, project_id, user_id, permission, invited_by, accepted_at, created_at)
VALUES 
    -- Designer collaborates on microservices project
    ('c0110000-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'write', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '30 days', NOW() - INTERVAL '35 days'),
    -- Developer collaborates on UI components
    ('c0220000-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'read', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', NOW() - INTERVAL '20 days', NOW() - INTERVAL '25 days'),
    -- Manager collaborates on API Gateway
    ('c0330000-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 'd4e5f6a7-b8c9-0123-def0-234567890123', 'read', 'c3d4e5f6-a7b8-9012-cdef-123456789012', NOW() - INTERVAL '15 days', NOW() - INTERVAL '18 days')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Create user followers table if not exists (for GitHub-style following)
CREATE TABLE IF NOT EXISTS user_followers (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id)
);

-- Seed follower relationships
INSERT INTO user_followers (follower_id, following_id, created_at)
VALUES 
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', NOW() - INTERVAL '40 days'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c3d4e5f6-a7b8-9012-cdef-123456789012', NOW() - INTERVAL '35 days'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '38 days'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'e5f6a7b8-c9d0-1234-ef01-345678901234', NOW() - INTERVAL '25 days'),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '30 days')
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- Create project stars table if not exists
CREATE TABLE IF NOT EXISTS project_stars (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, project_id)
);

-- Seed project stars
INSERT INTO project_stars (user_id, project_id, created_at)
VALUES 
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '30 days'),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '25 days'),
    ('d4e5f6a7-b8c9-0123-def0-234567890123', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '20 days'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '15 days'),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '10 days'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901234', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '5 days')
ON CONFLICT (user_id, project_id) DO NOTHING;
