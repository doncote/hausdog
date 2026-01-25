import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, Home, Loader2, MessageSquare, Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type ConversationWithLastMessage,
  MessageRole,
  useConversation,
  useConversationsForProperty,
  useCreateConversation,
  useDeleteConversation,
  useSendChatMessage,
} from '@/features/chat'
import { useCurrentProperty } from '@/hooks/use-current-property'

export const Route = createFileRoute('/_authenticated/chat')({
  validateSearch: (search: Record<string, unknown>) => ({
    conversationId: (search.conversationId as string) || undefined,
  }),
  component: ChatPage,
})

function ChatPage() {
  const { user } = Route.useRouteContext()
  const { conversationId: initialConversationId } = Route.useSearch()
  const { currentProperty, isLoaded } = useCurrentProperty()

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [selectedConversationId, setSelectedConversationId] = useState<string>(
    initialConversationId || '',
  )
  const [inputMessage, setInputMessage] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [conversationToDelete, setConversationToDelete] =
    useState<ConversationWithLastMessage | null>(null)

  const { data: conversations, isPending: conversationsLoading } = useConversationsForProperty(
    currentProperty?.id,
  )

  const { data: activeConversation, isPending: conversationLoading } = useConversation(
    selectedConversationId || undefined,
  )

  const createConversation = useCreateConversation()
  const sendMessage = useSendChatMessage()
  const deleteConversation = useDeleteConversation()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleNewConversation = async () => {
    if (!user || !currentProperty) return

    try {
      const conversation = await createConversation.mutateAsync({
        userId: user.id,
        input: { propertyId: currentProperty.id },
      })
      setSelectedConversationId(conversation.id)
    } catch (error) {
      console.error('Failed to create conversation:', error)
      toast.error('Failed to create conversation')
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConversationId || !currentProperty || !user) return

    const messageContent = inputMessage.trim()
    setInputMessage('')

    try {
      await sendMessage.mutateAsync({
        conversationId: selectedConversationId,
        propertyId: currentProperty.id,
        userId: user.id,
        message: messageContent,
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
            Select a property from the header to start chatting.
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
        <span className="font-medium">Chat</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Property Assistant</h1>
          <p className="text-muted-foreground mt-1">Ask questions about {currentProperty.name}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* New Conversation Button */}
          <Button
            onClick={handleNewConversation}
            disabled={createConversation.isPending}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>

          {/* Conversations List */}
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
                    role="button"
                    tabIndex={0}
                    className={`group flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-colors w-full text-left ${
                      selectedConversationId === conv.id ? 'bg-secondary' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedConversationId(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedConversationId(conv.id)
                      }
                    }}
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
              <p className="text-sm text-muted-foreground py-4 text-center">No conversations yet</p>
            )}
          </div>
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
                    Start a new conversation to ask questions about your home
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
                        {message.role === MessageRole.USER ? (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                            <Markdown>{message.content}</Markdown>
                          </div>
                        )}
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
                      disabled={sendMessage.isPending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || sendMessage.isPending}
                    >
                      {sendMessage.isPending ? (
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
              Are you sure you want to delete this conversation? This action cannot be undone.
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
