import React from 'react';
import { Container, Card, Row, Col } from 'react-bootstrap';
import { BiRightArrowAlt } from 'react-icons/bi';

const Projects = () => {
  const projects = [
    {
      title: 'web app for investing company',
      link: 'https://deepstone-1eefc.web.app/',
      description: "Built a react web app for a investment analysis platform."
    },
    {
      title: 'react e-commerce store',
      link: 'https://e-commerce-store-rwkdt95lx-alexs-projects-952b1d70.vercel.app/',
      description: "Web app for e-commerce using React, with API calls to a JSON database"
    },
    {
      title: 'website for consulting company',
      link: 'https://xido.se/',
      description: "Created a consultancy firm's website using plain HTML, CSS and JavaScript."
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
                <Card.Body className='project-card d-flex justify-content-between align-items-center'>
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
