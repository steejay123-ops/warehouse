from warehouses.models import Warehouse
from warehouses.serializers import WarehouseSerializer

Warehouse.objects.all().delete()

w1 = Warehouse(name="WH-1")
w1.save()
print("W1", w1.id, w1.code)

w2 = Warehouse(name="WH-2")
w2.save()
print("W2", w2.id, w2.code)
