from django.contrib import admin

from .models import DeliveryDetail, Order, OrderEvent, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    # An order's lines are a historical record. Making them read-only in the
    # admin means a well-meaning click cannot rewrite what a customer was
    # actually charged.
    readonly_fields = ("car", "quantity", "price_at_purchase", "options", "subtotal_display")
    can_delete = False

    @admin.display(description="Subtotal")
    def subtotal_display(self, obj: OrderItem) -> str:
        return f"£{obj.subtotal:,.2f}"

    def has_add_permission(self, request, obj=None) -> bool:
        return False


class DeliveryInline(admin.StackedInline):
    model = DeliveryDetail
    extra = 0
    can_delete = False


class OrderEventInline(admin.TabularInline):
    model = OrderEvent
    extra = 0
    can_delete = False
    readonly_fields = ("from_status", "to_status", "at", "actor", "note")

    def has_add_permission(self, request, obj=None) -> bool:
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    inlines = [DeliveryInline, OrderItemInline, OrderEventInline]

    list_display = ("id", "user", "status", "total_display", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("id", "user__username", "user__email")
    date_hierarchy = "created_at"
    readonly_fields = ("user", "created_at", "updated_at", "total_display")

    @admin.display(description="Order total")
    def total_display(self, obj: Order) -> str:
        # Reads the model property rather than recomputing -- the admin shows
        # the same number the API returns, by construction.
        return f"£{obj.total:,.2f}"

    def get_queryset(self, request):
        # The changelist renders user and total for every row. Without these the
        # admin issues a query per order for the user, plus one per order for
        # its items -- the same N+1 the API queryset avoids.
        return super().get_queryset(request).select_related("user").with_items()
