import { createFileRoute, Link } from '@tanstack/react-router'
import { Box, ChevronRight, Filter, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProperty } from '@/features/properties'
import {
  ItemCategory,
  useItemsForProperty,
  type ItemWithRelations,
} from '@/features/items'
import { useSpacesForProperty } from '@/features/spaces'

export const Route = createFileRoute('/_authenticated/properties/$propertyId/items/')({
  component: PropertyItemsPage,
})

function PropertyItemsPage() {
  const { propertyId } = Route.useParams()
  const { user } = Route.useRouteContext()

  const { data: property } = useProperty(propertyId, user?.id)
  const { data: items, isPending: itemsPending } = useItemsForProperty(propertyId)
  const { data: spaces } = useSpacesForProperty(propertyId)

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [spaceFilter, setSpaceFilter] = useState<string>('all')

  // Filter items based on search and filters
  const filteredItems = items?.filter((item) => {
    const matchesSearch = searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    const matchesSpace = spaceFilter === 'all' ||
      (spaceFilter === 'none' ? !item.spaceId : item.spaceId === spaceFilter)

    return matchesSearch && matchesCategory && matchesSpace
  }) || []

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="flex items-center gap-2 text-sm mb-8">
        <Link
          to="/properties"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Properties
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link
          to="/properties/$propertyId"
          params={{ propertyId }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {property?.name || 'Property'}
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Items</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground mt-1">
            All items tracked for {property?.name || 'this property'}
          </p>
        </div>
        <Link to="/items/new" search={{ propertyId, parentId: undefined, spaceId: undefined }}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(ItemCategory).map(([key, value]) => (
              <SelectItem key={value} value={value}>
                {key.charAt(0) + key.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {spaces && spaces.length > 0 && (
          <Select value={spaceFilter} onValueChange={setSpaceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Space" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Spaces</SelectItem>
              <SelectItem value="none">No Space</SelectItem>
              {spaces.map((space) => (
                <SelectItem key={space.id} value={space.id}>
                  {space.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {itemsPending ? (
        <div className="space-y-3">
          <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
          <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
          <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <p className="text-muted-foreground">No items match your filters</p>
          <Button
            variant="link"
            onClick={() => {
              setSearchQuery('')
              setCategoryFilter('all')
              setSpaceFilter('all')
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Box className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No items yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Add items like appliances, HVAC systems, or furniture to track their details
          </p>
          <Link to="/items/new" search={{ propertyId, parentId: undefined, spaceId: undefined }}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Item
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item }: { item: ItemWithRelations }) {
  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="group block"
    >
      <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-secondary p-2.5">
              <Box className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium group-hover:text-primary transition-colors">
                {item.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {item.category}
                {item.manufacturer && ` · ${item.manufacturer}`}
                {item.model && ` ${item.model}`}
              </p>
              {item.space && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  📍 {item.space.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {item._count && (
              <span className="hidden sm:inline">
                {item._count.children > 0 && `${item._count.children} sub-items`}
              </span>
            )}
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
