import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';

const Header = () => {
  return (
    <Container>
      <Navbar id='home' expand="lg" className="custom-navbar">
        <Nav className="custom-nav">
          <Nav.Link href="#projects" className="no-padding-left bold-nav-link">projects</Nav.Link>
          <Nav.Link href="#favorites" className="bold-nav-link">favorites</Nav.Link>
          <Nav.Link href="#contact" className="bold-nav-link">contact</Nav.Link>
        </Nav>      
      </Navbar>
    </Container>
  );
};

export default Header;
