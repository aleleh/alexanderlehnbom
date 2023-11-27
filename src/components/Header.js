import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { BiLogoLinkedinSquare } from "react-icons/bi";

const Header = () => {
  return (
    <Container>
      <Navbar id='home' className="custom-navbar">
        <Nav className="me-auto custom-nav">
          <Nav.Link href="#projects" className="no-padding-left bold-nav-link">projects</Nav.Link>
          <Nav.Link href="#favorites" className="bold-nav-link">favorites</Nav.Link>
          <Nav.Link href="#contact" className="bold-nav-link">contact</Nav.Link>
        </Nav>
        <Nav>
          <Nav.Link href='https://www.linkedin.com/in/alehnbom/' className='linkedin' target="_blank">
            <BiLogoLinkedinSquare />LinkedIn
          </Nav.Link>
        </Nav>
      </Navbar>
    </Container>
  );
};

export default Header;
