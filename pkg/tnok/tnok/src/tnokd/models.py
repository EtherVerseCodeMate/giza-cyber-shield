"""Database models.

This file is part of: Tnok - The TOTP port knocker

Copyright (c) 2024-present Assured Information Security (AIS).

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
from typing import Optional

from sqlalchemy import String, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from tnoklib import MAX_UID


class Base(DeclarativeBase):
    """Database model base class."""


class ClientSecret(Base):
    """Client secrets."""

    __tablename__ = "client_secret"

    uid: Mapped[str] = mapped_column(String(MAX_UID), primary_key=True)
    b32_secret: Mapped[str] = mapped_column(String(255))
    fullname: Mapped[Optional[str]]

    def __repr__(self) -> str:
        """Return string representation of a client secret."""
        return f"ClientSecret(uid={self.uid!r}, b32_secret={self.b32_secret!r}, fullname={self.fullname!r})"


class IPBlock(Base):
    """Blocked IP."""

    __tablename__ = "ip_block"

    ip_addr: Mapped[str] = mapped_column(String(50), primary_key=True)
    unblock_after: Mapped[int] = mapped_column(Integer())

    def __repr__(self) -> str:
        """Return string representation of an IP block."""
        return f"IPBlock(ip_addr={self.ip_addr!r}, unblock_after={self.unblock_after!r})"
