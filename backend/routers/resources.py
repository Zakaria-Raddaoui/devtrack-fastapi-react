from fastapi import APIRouter, HTTPException
from typing import List, Optional

router = APIRouter()

# Fake in-memory data store
resources_db = []

# Resource model
class Resource:
    def __init__(self, id: int, title: str, description: str):
        self.id = id
        self.title = title
        self.description = description

# Create a new resource
@router.post('/resources/', response_model=Resource)
def create_resource(resource: Resource):
    resources_db.append(resource)
    return resource

# Read all resources
@router.get('/resources/', response_model=List[Resource])
def read_resources():
    return resources_db

# Read a single resource by ID
@router.get('/resources/{resource_id}', response_model=Resource)
def read_resource(resource_id: int):
    resource = next((r for r in resources_db if r.id == resource_id), None)
    if resource is None:
        raise HTTPException(status_code=404, detail='Resource not found')
    return resource

# Update a resource by ID
@router.put('/resources/{resource_id}', response_model=Resource)
def update_resource(resource_id: int, updated_resource: Resource):
    resource_index = next((index for index, r in enumerate(resources_db) if r.id == resource_id), None)
    if resource_index is None:
        raise HTTPException(status_code=404, detail='Resource not found')
    resources_db[resource_index] = updated_resource
    return updated_resource

# Delete a resource by ID
@router.delete('/resources/{resource_id}', response_model=dict)
def delete_resource(resource_id: int):
    resource_index = next((index for index, r in enumerate(resources_db) if r.id == resource_id), None)
    if resource_index is None:
        raise HTTPException(status_code=404, detail='Resource not found')
    del resources_db[resource_index]
    return {'detail': 'Resource deleted successfully'}

