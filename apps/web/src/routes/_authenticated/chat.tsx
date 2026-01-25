import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProperties } from '@/features/properties'
import {
  useConversationsForProperty,
  useConversation,
  useCreateConversation,
  useCreateMessage,
  useDeleteConversation,
  MessageRole,
  type ConversationWithLastMessage,
} from '@/features/chat'

export const Route = createFileRoute('/_authenticated/chat')({
  validateSearch: (search: Record<string, unknown>) => ({
    propertyId: (search.propertyId as string) || undefined,
    conversationId: (search.conversationId as string) || undefined,
  }),
  component: ChatPage,
})

function ChatPage() {
  const { user } = Route.useRouteContext()
  const { propertyId: initialPropertyId, conversationId: initialConversationId } =
    Route.useSearch()

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: properties, isPending: propertiesLoading } = useProperties(user?.id)

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialPropertyId || '')
  const [selectedConversationId, setSelectedConversationId] = useState<string>(
    initialConversationId || '',
  )
  const [inputMessage, setInputMessage] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [conversationToDelete, setConversationToDelete] =
    useState<ConversationWithLastMessage | null>(null)

  const { data: conversations, isPending: conversationsLoading } =
    useConversationsForProperty(selectedPropertyId || undefined)

  const { data: activeConversation, isPending: conversationLoading } =
    useConversation(selectedConversationId || undefined)

  const createConversation = useCreateConversation()
  const createMessage = useCreateMessage()
  const deleteConversation = useDeleteConversation()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages])

  const handleNewConversation = async () => {
    if (!user || !selectedPropertyId) return

    try {
      const conversation = await createConversation.mutateAsync({
        userId: user.id,
        input: { propertyId: selectedPropertyId },
      })
      setSelectedConversationId(conversation.id)
    } catch (error) {
      console.error('Failed to create conversation:', error)
      toast.error('Failed to create conversation')
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConversationId) return

    const messageContent = inputMessage.trim()
    setInputMessage('')

    try {
      // Create user message
      await createMessage.mutateAsync({
        conversationId: selectedConversationId,
        input: {
          conversationId: selectedConversationId,
          role: MessageRole.USER,
          content: messageContent,
        },
      })

      // TODO: In a real implementation, this would call an AI endpoint
      // For now, create a placeholder assistant response
      await createMessage.mutateAsync({
        conversationId: selectedConversationId,
        input: {
          conversationId: selectedConversationId,
          role: MessageRole.ASSISTANT,
          content:
            "I'm your home assistant! I can help answer questions about your property, items, and maintenance history. AI responses are not yet implemented, but this is where they would appear.",
        },
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
    }
  }

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return

    try {
      await deleteConversation.mutateAsync({
        id: conversationToDelete.id,
        propertyId: conversationToDelete.propertyId,
      })
      if (selectedConversationId === conversationToDelete.id) {
        setSelectedConversationId('')
      }
      toast.success('Conversation deleted')
      setShowDeleteDialog(false)
      setConversationToDelete(null)
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error('Failed to delete conversation')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
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
        <span className="font-medium">Chat</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Property Assistant</h1>
          <p className="text-muted-foreground mt-1">
            Ask questions about your home and get AI-powered answers
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Property Selection */}
          <div className="space-y-2">
            <Label htmlFor="property">Property</Label>
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger id="property">
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {propertiesLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                ) : properties && properties.length > 0 ? (
                  properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No properties found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* New Conversation Button */}
          <Button
            onClick={handleNewConversation}
            disabled={!selectedPropertyId || createConversation.isPending}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>

          {/* Conversations List */}
          {selectedPropertyId && (
            <div className="space-y-2">
              <Label>Conversations</Label>
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations && conversations.length > 0 ? (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-colors ${
                        selectedConversationId === conv.id
                          ? 'bg-secondary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedConversationId(conv.id)}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {conv.title || 'New conversation'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage?.content || 'No messages yet'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConversationToDelete(conv)
                          setShowDeleteDialog(true)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No conversations yet
                </p>
              )}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border bg-card flex flex-col h-[600px]">
            {!selectedConversationId ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
                    <MessageSquare className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Select a property and start a new conversation to ask questions about
                    your home
                  </p>
                </div>
              </div>
            ) : conversationLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {activeConversation?.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === MessageRole.USER ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === MessageRole.USER
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={createMessage.isPending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || createMessage.isPending}
                    >
                      {createMessage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConversation}
              disabled={deleteConversation.isPending}
            >
              {deleteConversation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
