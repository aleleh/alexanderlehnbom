import React from 'react';
import { Container, Button } from 'react-bootstrap';
import { BiLogoNodejs } from "react-icons/bi";
import { BiLogoReact } from "react-icons/bi";


const About = () => {
  return (
    <Container className="my-5 center">
    <h3>hi, i'm alex 👋</h3>
      <p>
      I'm a tech support specialist and developer with a passion for running. I have experience in building applications with <Button href='https://nodejs.org/en/' variant="link" className='node-button' target="_blank">
          <BiLogoNodejs />Node.js
        </Button> and a particular enthusiasm for{' '}
        <Button href='https://react.dev/' variant="link" className='react-button' target="_blank">
          <BiLogoReact />React
        </Button>
      </p>
    </Container>
  );
};

export default About;
