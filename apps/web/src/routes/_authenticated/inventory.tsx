import { createFileRoute, Link } from '@tanstack/react-router'
import { Box, ChevronRight, Filter, Home, Loader2, Plus, Search } from 'lucide-react'
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
import { useCategories } from '@/features/categories'
import { useItemsForProperty } from '@/features/items'
import { useSpacesForProperty } from '@/features/spaces'
import { useCurrentProperty } from '@/hooks/use-current-property'

export const Route = createFileRoute('/_authenticated/inventory')({
  component: InventoryPage,
})

function InventoryPage() {
  const { user } = Route.useRouteContext()
  const { currentProperty, isLoaded } = useCurrentProperty()

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [spaceFilter, setSpaceFilter] = useState<string>('all')

  const { data: items, isPending: itemsLoading } = useItemsForProperty(currentProperty?.id)
  const { data: spaces } = useSpacesForProperty(currentProperty?.id)
  const { data: categories } = useCategories(user?.id)

  // Filter items
  const filteredItems =
    items?.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.model?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      const matchesSpace =
        spaceFilter === 'all' ||
        (spaceFilter === 'none' && !item.spaceId) ||
        item.spaceId === spaceFilter

      return matchesSearch && matchesCategory && matchesSpace
    }) || []

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!currentProperty) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No property selected</h3>
          <p className="text-muted-foreground mb-6">
            Select a property from the header to view inventory.
          </p>
          <Link to="/properties/new">
            <Button>Add Your First Property</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="flex items-center gap-2 text-sm mb-8">
        <Link
          to="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Inventory</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-1">Items in {currentProperty.name}</p>
        </div>
        <Link
          to="/items/new"
          search={{ propertyId: currentProperty.id, spaceId: undefined, parentId: undefined }}
        >
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
            {categories?.map((cat) => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {cat.name}
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

      {itemsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Box className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {items && items.length > 0 ? 'No matching items' : 'No items yet'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {items && items.length > 0
              ? 'Try adjusting your filters'
              : 'Add your first item to start tracking'}
          </p>
          {items && items.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setCategoryFilter('all')
                setSpaceFilter('all')
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Link
              to="/items/new"
              search={{ propertyId: currentProperty.id, spaceId: undefined, parentId: undefined }}
            >
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              to="/items/$itemId"
              params={{ itemId: item.id }}
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-secondary p-2.5">
                  <Box className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.category}
                    {item.space && ` · ${item.space.name}`}
                  </p>
                  {(item.manufacturer || item.model) && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {[item.manufacturer, item.model].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
