import { createServerFn } from '@tanstack/react-start'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { CategoryService } from './service'
import type { CreateCategoryInput, UpdateCategoryInput } from './types'

const getCategoryService = () => new CategoryService({ db: prisma, logger })

export const fetchCategories = createServerFn({ method: 'GET' })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getCategoryService()
    return service.findAllForUser(data.userId)
  })

export const createCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateCategoryInput }) => d)
  .handler(async ({ data }) => {
    const service = getCategoryService()
    return service.create(data.userId, data.input)
  })

export const updateCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; input: UpdateCategoryInput }) => d)
  .handler(async ({ data }) => {
    const service = getCategoryService()
    return service.update(data.id, data.input)
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getCategoryService()
    await service.delete(data.id)
    return { success: true }
  })
