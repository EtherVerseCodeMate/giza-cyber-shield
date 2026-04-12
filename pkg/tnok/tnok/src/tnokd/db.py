"""Handle creating and managing the database along with the database models.

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
import os
import logging
from typing import List, Optional, Dict

import pyotp

from sqlalchemy import create_engine, select, insert, delete
from sqlalchemy.orm import Session
from sqlalchemy.exc import NoResultFound

from tnokd import ip_version
from tnokd.errors import UserNotFound, UserExistsException, IPBlockNotFound
from tnokd.models import IPBlock, ClientSecret, Base


DEFAULT_ADMIN_USER = "admin"


class TnokdDatabase:
    """Base tnokd service database class."""

    # So we don't go to the database every time we call get_user
    _uid_cache: Dict[str, ClientSecret] = {}

    def __init__(self, db_file: str, debug: bool = False):
        """Create the TnokdDatabase object with a file path to a sqlite database."""
        self.db_file = db_file
        dir_path = os.path.dirname(self.db_file)
        if not os.path.exists(dir_path):
            raise FileNotFoundError(f"DB Directory {dir_path} does not exist.")

        create = not os.path.exists(self.db_file)
        self.db_url = f"sqlite+pysqlite:///{self.db_file}"
        self.engine = create_engine(self.db_url, echo=debug)
        if create:
            logging.info("Creating initial database")
            Base.metadata.create_all(self.engine)

        self._load_users()

    def _load_users(self) -> None:
        """Load and cache all ClientSecrets."""
        stmt = select(ClientSecret)
        with Session(self.engine) as session:
            client_secrets = list(session.scalars(stmt).all())
        for client_secret in client_secrets:
            if client_secret.uid not in self._uid_cache:
                self._uid_cache[client_secret.uid] = client_secret

    def add_user(self, uid: str = DEFAULT_ADMIN_USER, fullname: str = DEFAULT_ADMIN_USER) -> str:
        """Generate a secret and add a user to the DB. Defaults to the admin user."""
        if self.get_user(uid):
            raise UserExistsException(f"A user with UID {uid} already exists.")

        b32_secret = pyotp.random_base32()
        stmt = insert(ClientSecret).values(uid=uid, fullname=fullname, b32_secret=b32_secret)
        with Session(self.engine) as session:
            session.execute(stmt)
            session.commit()

        self.get_user(uid)  # Cache the new user
        return b32_secret

    def get_user(self, uid: str = DEFAULT_ADMIN_USER) -> Optional[ClientSecret]:
        """Get a user."""
        if uid in self._uid_cache:
            logging.debug(f"UID {uid} cached. Returning cached result {self._uid_cache[uid]}")
            return self._uid_cache[uid]

        stmt = select(ClientSecret).where(ClientSecret.uid == uid)
        with Session(self.engine) as session:
            try:
                user = session.scalars(stmt).one()
            except NoResultFound:
                return None

            self._uid_cache[uid] = user
            return user

    def get_users(self) -> List[ClientSecret]:
        """Get all users."""
        return list(self._uid_cache.values())

    def remove_user(self, uid: str):
        """Remove a user."""
        if not self.get_user(uid):
            raise UserNotFound(f"User {uid} not found in database")

        if uid in self._uid_cache:
            del self._uid_cache[uid]

        del_stmt = delete(ClientSecret).where(ClientSecret.uid == uid)
        with Session(self.engine) as session:
            session.execute(del_stmt)

            if uid == DEFAULT_ADMIN_USER:
                # We don't ever delete the default admin - just regenerate
                logging.info(f"Regenerating {DEFAULT_ADMIN_USER} secret key")
                b32_secret = pyotp.random_base32()
                insert_stmt = insert(ClientSecret).values(uid=uid, fullname=DEFAULT_ADMIN_USER, b32_secret=b32_secret)
                session.execute(insert_stmt)

            session.commit()

    def add_ip_block(self, ip_addr: str, unblock_after: int) -> None:
        """Add an IP block to the database."""
        try:
            ip_version(ip_addr)
        except ValueError as exc:
            logging.error(f"Invalid IP address {ip_addr}. {exc}")
            return

        if self.get_ip_block(ip_addr):
            logging.warning(f"IP address {ip_addr} is already blocked in the database. Not adding.")
            return  # Already exists

        stmt = insert(IPBlock).values(ip_addr=ip_addr, unblock_after=unblock_after)
        with Session(self.engine) as session:
            session.execute(stmt)
            session.commit()

    def get_ip_block(self, ip_addr: str) -> Optional[IPBlock]:
        """Get an IP block from the database."""
        stmt = select(IPBlock).where(IPBlock.ip_addr == ip_addr)
        with Session(self.engine) as session:
            try:
                return session.scalars(stmt).one()
            except NoResultFound:
                return None

    def get_blocked_ips(self) -> List[IPBlock]:
        """Get the list of blocked IPs from the DB."""
        stmt = select(IPBlock)
        with Session(self.engine) as session:
            return list(session.scalars(stmt).all())

    def remove_ip_block(self, ip_addr: str):
        """Remove an IP block from the database."""
        if not self.get_ip_block(ip_addr):
            raise IPBlockNotFound(f"IP {ip_addr} not found in block table")

        stmt = delete(IPBlock).where(IPBlock.ip_addr == ip_addr)
        with Session(self.engine) as session:
            session.execute(stmt)
            session.commit()

    def remove_all_ip_blocks(self):
        """Remove all IP blocks from the database."""
        stmt = delete(IPBlock)
        with Session(self.engine) as session:
            session.execute(stmt)
            session.commit()
