import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List

from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Float
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploaded_images"
UPLOAD_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./test.db')
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

class Project(Base):
    __tablename__ = 'projects'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    images = relationship('Image', back_populates='project', cascade="all, delete-orphan")

class Image(Base):
    __tablename__ = 'images'
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    project = relationship('Project', back_populates='images')
    #связь с аннотациями для каскадного удаления
    annotations = relationship('Annotation', back_populates='image', cascade="all, delete-orphan")

class Annotation(Base):
    __tablename__ = 'annotations'
    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey('images.id'))
    label = Column(String)
    x = Column(Float)
    y = Column(Float)
    width = Column(Float)
    height = Column(Float)
    image = relationship('Image', back_populates='annotations')

class AnnotationBase(BaseModel):
    label: str
    x: float
    y: float
    width: float
    height: float
    class Config:
        orm_mode = True

class ImageOut(BaseModel):
    id: int
    filename: str
    url: str
    class Config:
        orm_mode = True

class ProjectOut(BaseModel):
    id: int
    name: str
    images: List[ImageOut] = []
    class Config:
        orm_mode = True

class ProjectCreate(BaseModel):
    name: str

app = FastAPI()
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)

#API

@app.post("/projects", response_model=ProjectOut)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    existing = db.query(Project).filter(Project.name == project.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project already exists")
    db_proj = Project(name=project.name)
    db.add(db_proj)
    db.commit()
    db.refresh(db_proj)
    return db_proj

@app.get("/projects", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    # преобразует объекты
    for p in projects:
        for img in p.images:
            img.url = f"/files/{img.filename}"
    return projects

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for img in project.images:
        file_path = UPLOAD_DIR / img.filename
        if file_path.exists():
            file_path.unlink()
    db.delete(project)
    db.commit()
    return {"detail": "Deleted"}

@app.post("/projects/{project_id}/images", response_model=List[ImageOut])
async def upload_images(project_id: int, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    images_out = []
    for upload in files:
        contents = await upload.read()
        filename = f"{project_id}_{upload.filename}"
        file_path = UPLOAD_DIR / filename
        with open(file_path, "wb") as f:
            f.write(contents)
        
        db_img = Image(filename=filename, project=project)
        db.add(db_img)
        db.commit()
        db.refresh(db_img)
        images_out.append(ImageOut(id=db_img.id, filename=filename, url=f"/files/{filename}"))
    return images_out

@app.get("/projects/{project_id}/images", response_model=List[ImageOut])
def list_images(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    for img in project.images:
        img.url = f"/files/{img.filename}"
    return project.images

@app.delete("/images/{image_id}")
def delete_image(image_id: int, db: Session = Depends(get_db)):
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    file_path = UPLOAD_DIR / img.filename
    if file_path.exists():
        file_path.unlink()
    db.delete(img)
    db.commit()
    return {"detail": "Deleted"}

@app.get("/files/{filename}")
def get_file(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@app.get("/images/{image_id}/annotations", response_model=List[AnnotationBase])
def get_annotations(image_id: int, db: Session = Depends(get_db)):
    return db.query(Annotation).filter(Annotation.image_id == image_id).all()

@app.post("/images/{image_id}/annotations")
def save_annotations(image_id: int, annotations: List[AnnotationBase], db: Session = Depends(get_db)):
    # проверка существования изобр
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
        
    db.query(Annotation).filter(Annotation.image_id == image_id).delete()
    for a in annotations:
        db.add(Annotation(image_id=image_id, **a.dict()))
    db.commit()
    return {"status": "ok"}

frontend_path = BASE_DIR / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")