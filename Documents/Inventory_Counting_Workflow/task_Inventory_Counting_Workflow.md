<div dir="rtl">

- [x] **Backend: Database & Models**
  - [x] Add `CountTask` model to `inventory/models.py`
  - [x] Make migrations and migrate
- [x] **Backend: API & Views**
  - [x] Create `CountTaskSerializer` in `inventory/serializers.py`
  - [x] Create `CountTaskViewSet` in `inventory/views.py` (with roles permission logic)
  - [x] Update `bulk_assign` in `inventory/views.py` to create `CountTask` records
  - [x] Update `urls.py` for new endpoints
- [x] **Frontend: Dispatch Panel**
  - [x] Update `dispatch.html` to add supervisor dropdown
  - [x] Update `dispatch.ts` to pass `supervisor_id` to API
- [x] **Frontend: Counter Dashboard (Mobile)**
  - [x] Create route and component for Counter (`CountTaskCard`)
  - [x] UI for entering `counted_balance` and `counter_note` without showing system balance
- [x] **Frontend: Supervisor Dashboard**
  - [x] Create route and component for Supervisor
  - [x] UI for reviewing counters, approving, or rejecting (without showing system balance)
- [x] **Frontend: Manager Dashboard**
  - [x] Create route and component for Manager Final Review
  - [x] UI for side-by-side comparison (system balance vs counted balance)
  - [x] Final approve / Request recount logic

</div>
