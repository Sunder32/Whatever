import { createRequire } from 'module'
const require = createRequire(import.meta.url)

let Database: any
let knex: any
let Knex: any

try {
  Database = require('better-sqlite3')
  knex = require('knex').default || require('knex')
  Knex = knex
} catch (error) {
  console.warn('SQLite dependencies not available, database features will be disabled')
}

import * as path from 'path'
import { app } from 'electron'

let db: any = null

export function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'diagram-app.db')
}

export async function initDatabase(): Promise<any> {
  if (db) return db
  
  if (!knex) {
    console.warn('Database not available - SQLite not installed')
    return null
  }

  const dbPath = getDbPath()
  
  db = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true
  })

  // Run migrations
  await runMigrations(db)
  
  return db
}

async function runMigrations(db: any): Promise<void> {
  if (!db) return
  // Check if tables exist
  const hasProjects = await db.schema.hasTable('projects')
  
  if (!hasProjects) {
    // Create projects table
    await db.schema.createTable('projects', (table: any) => {
      table.uuid('id').primary()
      table.string('name').notNullable()
      table.text('description')
      table.json('tags').defaultTo('[]')
      table.json('settings').defaultTo('{}')
      table.json('metadata').defaultTo('{}')
      table.boolean('is_archived').defaultTo(false)
      table.string('thumbnail')
      table.timestamp('created_at').defaultTo(db.fn.now())
      table.timestamp('updated_at').defaultTo(db.fn.now())
      table.timestamp('deleted_at')
      table.string('server_id') // ID on remote server for sync
      table.timestamp('last_synced_at')
    })

    // Create schemas table
    await db.schema.createTable('schemas', (table: any) => {
      table.uuid('id').primary()
      table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE')
      table.string('name').notNullable()
      table.string('file_name').notNullable()
      table.json('content').defaultTo('{}')
      table.json('canvas_state').defaultTo('{}')
      table.string('format_version').defaultTo('1.0.0')
      table.boolean('is_encrypted').defaultTo(false)
      table.string('encryption_iv')
      table.json('metadata').defaultTo('{}')
      table.timestamp('created_at').defaultTo(db.fn.now())
      table.timestamp('updated_at').defaultTo(db.fn.now())
      table.timestamp('deleted_at')
      table.string('server_id')
      table.timestamp('last_synced_at')
    })

    // Create sync_queue table for offline operations
    await db.schema.createTable('sync_queue', (table: any) => {
      table.uuid('id').primary()
      table.string('entity_type').notNullable() // 'project', 'schema', 'asset'
      table.uuid('entity_id').notNullable()
      table.string('operation').notNullable() // 'create', 'update', 'delete'
      table.json('data').notNullable()
      table.integer('retry_count').defaultTo(0)
      table.timestamp('created_at').defaultTo(db.fn.now())
      table.string('status').defaultTo('pending') // 'pending', 'syncing', 'failed', 'completed'
      table.text('error_message')
    })

    // Create assets table for local file references
    await db.schema.createTable('assets', (table: any) => {
      table.uuid('id').primary()
      table.uuid('schema_id').references('id').inTable('schemas').onDelete('CASCADE')
      table.string('name').notNullable()
      table.string('type').notNullable() // 'image', 'icon', 'attachment'
      table.string('mime_type')
      table.string('local_path')
      table.text('data_url') // For small assets, store as base64
      table.integer('size')
      table.timestamp('created_at').defaultTo(db.fn.now())
      table.string('server_id')
    })

    // Create settings table
    await db.schema.createTable('settings', (table: any) => {
      table.string('key').primary()
      table.json('value')
      table.timestamp('updated_at').defaultTo(db.fn.now())
    })

    console.log('Database tables created successfully')
  }
}

export function getDatabase(): any {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
  }
}

// Repository functions for Projects
export const projectsRepository = {
  async getAll() {
    const database = getDatabase()
    return database('projects').whereNull('deleted_at').orderBy('updated_at', 'desc')
  },

  async getById(id: string) {
    const database = getDatabase()
    return database('projects').where({ id }).whereNull('deleted_at').first()
  },

  async create(project: {
    id: string
    name: string
    description?: string
    tags?: string[]
    settings?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }) {
    const database = getDatabase()
    const now = new Date().toISOString()
    await database('projects').insert({
      ...project,
      tags: JSON.stringify(project.tags || []),
      settings: JSON.stringify(project.settings || {}),
      metadata: JSON.stringify(project.metadata || {}),
      created_at: now,
      updated_at: now
    })
    return this.getById(project.id)
  },

  async update(id: string, data: Partial<{
    name: string
    description: string
    tags: string[]
    settings: Record<string, unknown>
    metadata: Record<string, unknown>
    is_archived: boolean
    thumbnail: string
  }>) {
    const database = getDatabase()
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags)
    if (data.settings !== undefined) updateData.settings = JSON.stringify(data.settings)
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)
    if (data.is_archived !== undefined) updateData.is_archived = data.is_archived
    if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail

    await database('projects').where({ id }).update(updateData)
    return this.getById(id)
  },

  async delete(id: string) {
    const database = getDatabase()
    // Soft delete
    await database('projects').where({ id }).update({
      deleted_at: new Date().toISOString()
    })
  }
}

// Repository functions for Schemas
export const schemasRepository = {
  async getByProjectId(projectId: string) {
    const database = getDatabase()
    return database('schemas').where({ project_id: projectId }).whereNull('deleted_at')
  },

  async getById(id: string) {
    const database = getDatabase()
    return database('schemas').where({ id }).whereNull('deleted_at').first()
  },

  async create(schema: {
    id: string
    project_id: string
    name: string
    file_name: string
    content?: Record<string, unknown>
    canvas_state?: Record<string, unknown>
    format_version?: string
    metadata?: Record<string, unknown>
  }) {
    const database = getDatabase()
    const now = new Date().toISOString()
    await database('schemas').insert({
      ...schema,
      content: JSON.stringify(schema.content || {}),
      canvas_state: JSON.stringify(schema.canvas_state || {}),
      metadata: JSON.stringify(schema.metadata || {}),
      format_version: schema.format_version || '1.0.0',
      created_at: now,
      updated_at: now
    })
    return this.getById(schema.id)
  },

  async update(id: string, data: Partial<{
    name: string
    file_name: string
    content: Record<string, unknown>
    canvas_state: Record<string, unknown>
    is_encrypted: boolean
    encryption_iv: string
    metadata: Record<string, unknown>
  }>) {
    const database = getDatabase()
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.file_name !== undefined) updateData.file_name = data.file_name
    if (data.content !== undefined) updateData.content = JSON.stringify(data.content)
    if (data.canvas_state !== undefined) updateData.canvas_state = JSON.stringify(data.canvas_state)
    if (data.is_encrypted !== undefined) updateData.is_encrypted = data.is_encrypted
    if (data.encryption_iv !== undefined) updateData.encryption_iv = data.encryption_iv
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)

    await database('schemas').where({ id }).update(updateData)
    return this.getById(id)
  },

  async delete(id: string) {
    const database = getDatabase()
    await database('schemas').where({ id }).update({
      deleted_at: new Date().toISOString()
    })
  }
}

// Sync queue operations
export const syncQueueRepository = {
  async add(item: {
    id: string
    entity_type: string
    entity_id: string
    operation: string
    data: Record<string, unknown>
  }) {
    const database = getDatabase()
    await database('sync_queue').insert({
      ...item,
      data: JSON.stringify(item.data),
      created_at: new Date().toISOString()
    })
  },

  async getPending() {
    const database = getDatabase()
    return database('sync_queue')
      .where({ status: 'pending' })
      .orderBy('created_at', 'asc')
  },

  async markCompleted(id: string) {
    const database = getDatabase()
    await database('sync_queue').where({ id }).update({ status: 'completed' })
  },

  async markFailed(id: string, errorMessage: string) {
    const database = getDatabase()
    await database('sync_queue').where({ id }).update({
      status: 'failed',
      error_message: errorMessage,
      retry_count: database.raw('retry_count + 1')
    })
  },

  async clearCompleted() {
    const database = getDatabase()
    await database('sync_queue').where({ status: 'completed' }).delete()
  }
}

// Settings operations
export const settingsRepository = {
  async get(key: string) {
    const database = getDatabase()
    const row = await database('settings').where({ key }).first()
    return row ? JSON.parse(row.value) : null
  },

  async set(key: string, value: unknown) {
    const database = getDatabase()
    const exists = await database('settings').where({ key }).first()
    
    if (exists) {
      await database('settings').where({ key }).update({
        value: JSON.stringify(value),
        updated_at: new Date().toISOString()
      })
    } else {
      await database('settings').insert({
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString()
      })
    }
  },

  async delete(key: string) {
    const database = getDatabase()
    await database('settings').where({ key }).delete()
  }
}
