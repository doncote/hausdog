import { createServerFn } from '@tanstack/react-start'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { getSafeSession } from '@/lib/supabase'
import { CategoryService } from './service'
import type { CreateCategoryInput, UpdateCategoryInput } from './types'

const getCategoryService = () => new CategoryService({ db: prisma, logger })

export const fetchCategories = createServerFn({ method: 'GET' })
  .inputValidator((d: Record<string, never>) => d)
  .handler(async () => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getCategoryService()
    return service.findAllForUser(user.id)
  })

export const createCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateCategoryInput }) => d)
  .handler(async ({ data }) => {
    const service = getCategoryService()
    return service.create(data.userId, data.input)
  })

export const updateCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateCategoryInput }) => d)
  .handler(async ({ data }) => {
    const service = getCategoryService()
    const existing = await service.findById(data.id)
    if (!existing) throw new Error('Category not found')
    if (existing.isSystem || existing.userId !== data.userId) {
      throw new Error('Access denied')
    }
    return service.update(data.id, data.input)
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getCategoryService()
    const existing = await service.findById(data.id)
    if (!existing) throw new Error('Category not found')
    if (existing.isSystem || existing.userId !== data.userId) {
      throw new Error('Access denied')
    }
    await service.delete(data.id)
    return { success: true }
  })
