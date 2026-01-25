import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { CategoryService } from './service'

const getCategoryService = () => new CategoryService({ db: prisma, logger })

export const fetchCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const service = getCategoryService()
  return service.findAll()
})
