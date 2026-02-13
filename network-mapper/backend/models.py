from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class Building(Base):
    __tablename__ = 'buildings'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    floorplans = relationship('Floorplan', back_populates='building')
    devices = relationship('Device', back_populates='building')

class Floorplan(Base):
    __tablename__ = 'floorplans'
    id = Column(Integer, primary_key=True)
    building_id = Column(Integer, ForeignKey('buildings.id'), nullable=False)
    filename = Column(String, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    created = Column(DateTime, default=datetime.utcnow)
    building = relationship('Building', back_populates='floorplans')

class Device(Base):
    __tablename__ = 'devices'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    ip = Column(String, nullable=True)
    device_type = Column(String, nullable=False)
    building_id = Column(Integer, ForeignKey('buildings.id'), nullable=True)
    floorplan_id = Column(Integer, ForeignKey('floorplans.id'), nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    note = Column(String, nullable=True)
    mac = Column(String, nullable=True)
    room = Column(String, nullable=True)
    created = Column(DateTime, default=datetime.utcnow)
    building = relationship('Building', back_populates='devices')
