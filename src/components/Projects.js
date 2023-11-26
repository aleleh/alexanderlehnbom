import React from 'react';
import { Container, Card, Row, Col } from 'react-bootstrap';
import { BiRightArrowAlt } from 'react-icons/bi';

const Projects = () => {
  const projects = [
    {
      title: 'react web app for investing company',
      link: 'https://deepstone-1eefc.web.app/',
      description: "Some quick example text to build on the card title and make up the bulk of the card's content."
    },
    {
      title: 'react e-commerce store',
      link: 'https://deepstone-1eefc.web.app/',
      description: "Some quick example text to build on the card title and make up the bulk of the card's content."
    },
    {
      title: 'website for consulting company',
      link: 'https://xido.se/',
      description: "Some quick example text to build on the card title and make up the bulk of the card's content."
    }
    // Add more projects here
  ];

  return (
    <Container className="my-5">
      <h3 id='projects'>projects</h3>
      <Row>
        {projects.map((project, index) => (
          <Col xs={12} className="mb-3" key={index}>
            <a href={project.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card>
                <Card.Body className='d-flex justify-content-between align-items-center'>
                  <div>
                    <Card.Title>{project.title}</Card.Title>
                    <Card.Text>{project.description}</Card.Text>
                  </div>
                  <BiRightArrowAlt className="arrow-icon" />
                </Card.Body>
              </Card>
            </a>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default Projects;
